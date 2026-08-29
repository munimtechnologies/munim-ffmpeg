/*
 * JNI wrapper over the platform-neutral core. Everything interesting lives in
 * munim_ffmpeg_core.c; this file only marshals between Java and C.
 */
#include <jni.h>
#include <stdlib.h>
#include <string.h>

#include "munim_ffmpeg_core.h"

static JavaVM *vm;
static jclass callbacks;
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

static void forward_log(void *context, const char *message)
{
    int attached = 0;
    JNIEnv *env = attach(&attached);
    if (!env) return;

    jstring text = (*env)->NewStringUTF(env, message);
    if (text) {
        (*env)->CallStaticVoidMethod(env, callbacks, on_log, text);
        (*env)->DeleteLocalRef(env, text);
    }

    if (attached) (*vm)->DetachCurrentThread(vm);
}

static void forward_statistics(void *context, double time_ms, double size_bytes,
                               double bitrate_kbits, double speed,
                               double video_frame_number, double fps,
                               double quality)
{
    int attached = 0;
    JNIEnv *env = attach(&attached);
    if (!env) return;

    (*env)->CallStaticVoidMethod(env, callbacks, on_statistics, time_ms,
                                 size_bytes, bitrate_kbits, speed,
                                 video_frame_number, fps, quality);

    if (attached) (*vm)->DetachCurrentThread(vm);
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *loaded, void *reserved)
{
    JNIEnv *env = NULL;
    vm = loaded;
    if ((*vm)->GetEnv(vm, (void **)&env, JNI_VERSION_1_6) != JNI_OK) return JNI_ERR;

    jclass local = (*env)->FindClass(env, "com/margelo/nitro/munimffmpeg/FFmpegNative");
    if (!local) return JNI_ERR;

    callbacks = (*env)->NewGlobalRef(env, local);
    on_log = (*env)->GetStaticMethodID(env, callbacks, "onLog",
                                       "(Ljava/lang/String;)V");
    on_statistics = (*env)->GetStaticMethodID(env, callbacks, "onStatistics",
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
                                                              jstring stdoutPath)
{
    jsize count = (*env)->GetArrayLength(env, args);
    const char **argv = to_argv(env, args, count);
    if (!argv) return -1;

    const char *out = (*env)->GetStringUTFChars(env, stdoutPath, NULL);
    int ret = munim_ffmpeg_execute((int)count, argv, out);
    (*env)->ReleaseStringUTFChars(env, stdoutPath, out);

    free_argv(argv, count);
    return ret;
}

JNIEXPORT jint JNICALL
Java_com_margelo_nitro_munimffmpeg_FFmpegNative_nativeExecuteProbe(JNIEnv *env, jclass clazz,
                                                                   jobjectArray args,
                                                                   jstring outputPath)
{
    jsize count = (*env)->GetArrayLength(env, args);
    const char **argv = to_argv(env, args, count);
    if (!argv) return -1;

    const char *out = (*env)->GetStringUTFChars(env, outputPath, NULL);
    int ret = munim_ffmpeg_probe((int)count, argv, out);
    (*env)->ReleaseStringUTFChars(env, outputPath, out);

    free_argv(argv, count);
    return ret;
}

JNIEXPORT void JNICALL
Java_com_margelo_nitro_munimffmpeg_FFmpegNative_nativeCancel(JNIEnv *env, jclass clazz)
{
    munim_ffmpeg_cancel();
}
