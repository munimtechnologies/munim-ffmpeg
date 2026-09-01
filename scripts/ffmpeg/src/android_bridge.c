/*
 * JNI wrapper over the platform-neutral core. Everything interesting lives in
 * munim_ffmpeg_core.c; this file only marshals between Java and C.
 */
#include <jni.h>
#include <stdlib.h>
#include <string.h>

#include "munim_ffmpeg_core.h"

static JavaVM *vm;
static jclass session_class;
static jmethodID on_log;
static jmethodID on_statistics;

static JNIEnv *attach(int *attached)
{
    JNIEnv *env = NULL;
    *attached = 0;
    if ((*vm)->GetEnv(vm, (void **)&env, JNI_VERSION_1_6) == JNI_OK) return env;
    if ((*vm)->AttachCurrentThread(vm, &env, NULL) != JNI_OK) return NULL;
    *attached = 1;
    return env;
}

/* `context` is a global reference to the FFmpegSession of the run currently
 * holding the core's lock; the core swaps it in and out per execution. */
static void forward_log(void *context, const char *message)
{
    if (!context) return;

    int attached = 0;
    JNIEnv *env = attach(&attached);
    if (!env) return;

    jstring text = (*env)->NewStringUTF(env, message);
    if (text) {
        (*env)->CallVoidMethod(env, (jobject)context, on_log, text);
        (*env)->DeleteLocalRef(env, text);
    }

    if (attached) (*vm)->DetachCurrentThread(vm);
}

static void forward_statistics(void *context, double time_ms, double size_bytes,
                               double bitrate_kbits, double speed,
                               double video_frame_number, double fps,
                               double quality)
{
    if (!context) return;

    int attached = 0;
    JNIEnv *env = attach(&attached);
    if (!env) return;

    (*env)->CallVoidMethod(env, (jobject)context, on_statistics, time_ms,
                           size_bytes, bitrate_kbits, speed,
                           video_frame_number, fps, quality);

    if (attached) (*vm)->DetachCurrentThread(vm);
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *loaded, void *reserved)
{
    JNIEnv *env = NULL;
    vm = loaded;
    if ((*vm)->GetEnv(vm, (void **)&env, JNI_VERSION_1_6) != JNI_OK) return JNI_ERR;

    jclass local = (*env)->FindClass(env, "com/margelo/nitro/munimffmpeg/FFmpegSession");
    if (!local) return JNI_ERR;

    session_class = (*env)->NewGlobalRef(env, local);
    on_log = (*env)->GetMethodID(env, session_class, "onLog",
                                 "(Ljava/lang/String;)V");
    on_statistics = (*env)->GetMethodID(env, session_class, "onStatistics",
                                        "(DDDDDDD)V");
    if (!on_log || !on_statistics) return JNI_ERR;

    munim_ffmpeg_set_callbacks(forward_log, forward_statistics, NULL);
    return JNI_VERSION_1_6;
}

static const char **to_argv(JNIEnv *env, jobjectArray args, jsize count)
{
    const char **argv = calloc(count + 1, sizeof(char *));
    if (!argv) return NULL;

    for (jsize i = 0; i < count; i++) {
        jstring item = (jstring)(*env)->GetObjectArrayElement(env, args, i);
        const char *chars = (*env)->GetStringUTFChars(env, item, NULL);
        argv[i] = strdup(chars);
        (*env)->ReleaseStringUTFChars(env, item, chars);
        (*env)->DeleteLocalRef(env, item);
    }
    return argv;
}

static void free_argv(const char **argv, jsize count)
{
    for (jsize i = 0; i < count; i++) free((void *)argv[i]);
    free((void *)argv);
}

JNIEXPORT jstring JNICALL
Java_com_margelo_nitro_munimffmpeg_FFmpegNative_nativeVersion(JNIEnv *env, jclass clazz)
{
    return (*env)->NewStringUTF(env, munim_ffmpeg_version());
}

JNIEXPORT jint JNICALL
Java_com_margelo_nitro_munimffmpeg_FFmpegNative_nativeExecute(JNIEnv *env, jclass clazz,
                                                              jobjectArray args,
                                                              jstring stdoutPath,
                                                              jobject session)
{
    jsize count = (*env)->GetArrayLength(env, args);
    const char **argv = to_argv(env, args, count);
    if (!argv) return -1;

    /* Callbacks arrive on FFmpeg's own threads while this call blocks, so the
     * session needs a global reference for the duration of the run. */
    jobject session_ref = (*env)->NewGlobalRef(env, session);

    const char *out = (*env)->GetStringUTFChars(env, stdoutPath, NULL);
    int ret = munim_ffmpeg_execute_ctx((int)count, argv, out, session_ref);
    (*env)->ReleaseStringUTFChars(env, stdoutPath, out);

    (*env)->DeleteGlobalRef(env, session_ref);
    free_argv(argv, count);
    return ret;
}

JNIEXPORT jint JNICALL
Java_com_margelo_nitro_munimffmpeg_FFmpegNative_nativeExecuteProbe(JNIEnv *env, jclass clazz,
                                                                   jobjectArray args,
                                                                   jstring outputPath,
                                                                   jobject session)
{
    jsize count = (*env)->GetArrayLength(env, args);
    const char **argv = to_argv(env, args, count);
    if (!argv) return -1;

    jobject session_ref = (*env)->NewGlobalRef(env, session);

    const char *out = (*env)->GetStringUTFChars(env, outputPath, NULL);
    int ret = munim_ffmpeg_probe_ctx((int)count, argv, out, session_ref);
    (*env)->ReleaseStringUTFChars(env, outputPath, out);

    (*env)->DeleteGlobalRef(env, session_ref);
    free_argv(argv, count);
    return ret;
}

JNIEXPORT void JNICALL
Java_com_margelo_nitro_munimffmpeg_FFmpegNative_nativeCancel(JNIEnv *env, jclass clazz)
{
    munim_ffmpeg_cancel();
}
