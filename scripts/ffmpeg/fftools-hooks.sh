#!/usr/bin/env bash
# Applies the entire patch munim-ffmpeg needs against upstream FFmpeg fftools.
#
# Everything else is stock. Usage: fftools-hooks.sh <copy-of-fftools-dir>
set -euo pipefail

SRC="$1"

# ffmpeg.c: the signal flags and per-run state are file-static, so cancellation
# and reset have to be reachable from inside the translation unit.
cat >> "$SRC/ffmpeg.c" <<'HOOKS'

/* ---- munim-ffmpeg in-process hooks ---- */
void munim_ffmpeg_hook_cancel(void)
{
    received_sigterm = SIGINT;
    received_nb_signals++;
}

void munim_ffmpeg_hook_reset(void)
{
    received_sigterm = 0;
    received_nb_signals = 0;
    atomic_store(&transcode_init_done, 0);
    atomic_store(&nb_output_dumped, 0);
    copy_ts_first_pts = AV_NOPTS_VALUE;
    ffmpeg_exited = 0;

    /* ffmpeg_cleanup() frees these arrays but leaves the counters set, so a
     * second run would walk freed memory. */
    nb_input_files   = 0;
    nb_output_files  = 0;
    nb_filtergraphs  = 0;
    nb_decoders      = 0;
    vstats_file      = NULL;
}
HOOKS

# ffprobe.c: refuses a second -o ("already specified") and remembers the
# previous input unless its filename statics are cleared.
cat >> "$SRC/ffprobe.c" <<'PROBEHOOKS'

/* ---- munim-ffmpeg in-process hooks ---- */
void munim_ffprobe_hook_reset(void)
{
    av_freep((void *)&output_filename);
    input_filename = NULL;
    print_input_filename = NULL;
    find_stream_info = 1;
}
PROBEHOOKS

# -print_graphs embeds an HTML/CSS resource manager that is only generated when
# building the CLI binaries, and has no use on mobile.
mkdir -p "$SRC/graph"
cat > "$SRC/graph/graphprint_stub.c" <<'STUB'
#include "fftools/ffmpeg.h"
#include "fftools/graph/graphprint.h"

int print_filtergraphs(FilterGraph **graphs, int nb_graphs,
                       InputFile **ifiles, int nb_ifiles,
                       OutputFile **ofiles, int nb_ofiles)
{
    return 0;
}

int print_filtergraph(FilterGraph *fg, AVFilterGraph *graph)
{
    return 0;
}
STUB
