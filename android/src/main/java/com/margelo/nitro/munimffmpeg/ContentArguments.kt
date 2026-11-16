package com.margelo.nitro.munimffmpeg

import android.content.ContentResolver
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.margelo.nitro.NitroModules
import java.io.Closeable
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.UUID

/**
 * Lets `content://` URIs — what the system photo picker, the Storage Access
 * Framework and MediaStore hand out — be used as FFmpeg inputs and outputs.
 *
 * FFmpeg cannot open a content URI by name, so each one is rewritten before
 * the run:
 *
 * - an input (`-i content://…`, or any content URI given to FFprobe) is opened
 *   through the ContentResolver and passed as `-fd <n> -i fd:`. FFmpeg reads
 *   the file descriptor directly: nothing is copied.
 * - an output is written to a private temporary file, which [commit] copies
 *   into the URI once the run succeeds. Muxers such as MP4 seek back and
 *   re-read their output (`-movflags +faststart`), which a provider's stream
 *   cannot do, so writing directly would fail.
 *
 * Content URIs inside filter graphs or concat lists are not rewritten.
 */
internal class ContentArguments private constructor(
  val arguments: Array<String>,
  private val resolver: ContentResolver?,
  private val descriptors: List<ParcelFileDescriptor>,
  private val outputs: List<Pair<File, Uri>>,
) : Closeable {

  /** Copies every output into its content URI. Call after a successful run. */
  fun commit() {
    val resolver = resolver ?: return
    for ((file, uri) in outputs) {
      if (!file.exists()) continue
      val stream = openOutput(resolver, uri)
        ?: throw IOException("Could not open $uri for writing")
      stream.use { output ->
        file.inputStream().use { input -> input.copyTo(output, COPY_BUFFER) }
      }
    }
  }

  /** Closes the input descriptors and deletes the temporary outputs. */
  override fun close() {
    descriptors.forEach { runCatching { it.close() } }
    outputs.forEach { (file, _) -> file.delete() }
  }

  companion object {
    private const val SCHEME = "content://"
    private const val COPY_BUFFER = 256 * 1024

    /**
     * Rewrites the content URIs in [arguments]. For FFprobe ([probe]) every
     * content URI is an input; for FFmpeg, one that follows `-i` is an input
     * and any other is an output.
     */
    fun prepare(arguments: Array<String>, probe: Boolean): ContentArguments {
      if (arguments.none { it.startsWith(SCHEME) }) {
        return ContentArguments(arguments, null, emptyList(), emptyList())
      }

      val context = NitroModules.applicationContext
        ?: throw IllegalStateException(
          "content:// URIs need the React Native application context, which is not available yet"
        )
      val resolver = context.contentResolver
      val descriptors = ArrayList<ParcelFileDescriptor>()
      val outputs = ArrayList<Pair<File, Uri>>()
      val rewritten = ArrayList<String>(arguments.size + 4)

      try {
        arguments.forEachIndexed { index, argument ->
          if (!argument.startsWith(SCHEME)) {
            rewritten.add(argument)
            return@forEachIndexed
          }

          val uri = Uri.parse(argument)
          val followsInputFlag = index > 0 && arguments[index - 1] == "-i"
          if (probe || followsInputFlag) {
            val descriptor = resolver.openFileDescriptor(uri, "r")
              ?: throw FileNotFoundException("Could not open $argument for reading")
            descriptors.add(descriptor)
            val fd = descriptor.fd.toString()
            if (followsInputFlag) {
              // `-fd` is an input option, so it goes in front of the `-i`
              // that was already copied.
              val flag = rewritten.size - 1
              rewritten.add(flag, "-fd")
              rewritten.add(flag + 1, fd)
            } else {
              rewritten.add("-fd")
              rewritten.add(fd)
            }
            rewritten.add("fd:")
          } else {
            // Not created here: FFmpeg would refuse to overwrite it without -y.
            val file = File(
              context.cacheDir,
              "munim-ffmpeg-${UUID.randomUUID()}${extension(resolver, uri)}",
            )
            outputs.add(file to uri)
            rewritten.add(file.absolutePath)
          }
        }
      } catch (error: Throwable) {
        descriptors.forEach { runCatching { it.close() } }
        throw error
      }

      return ContentArguments(rewritten.toTypedArray(), resolver, descriptors, outputs)
    }

    /**
     * The extension FFmpeg needs to pick a muxer, from the document's display
     * name or else its MIME type. Empty when neither says; pass `-f` then.
     */
    private fun extension(resolver: ContentResolver, uri: Uri): String {
      val fromName = runCatching {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) cursor.getString(0) else null
        }
      }.getOrNull()?.substringAfterLast('.', "")

      if (!fromName.isNullOrEmpty() && fromName.length <= 8) return ".$fromName"

      val fromType = runCatching {
        resolver.getType(uri)?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
      }.getOrNull()
      return if (fromType.isNullOrEmpty()) "" else ".$fromType"
    }

    /** "wt" truncates; some providers only accept "w". */
    private fun openOutput(resolver: ContentResolver, uri: Uri) =
      runCatching { resolver.openOutputStream(uri, "wt") }.getOrNull()
        ?: resolver.openOutputStream(uri, "w")
  }
}
