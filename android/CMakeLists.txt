project(NitroMunimFfmpeg)
cmake_minimum_required(VERSION 3.13)

set (PACKAGE_NAME NitroMunimFfmpeg)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroMunimFfmpeg+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
)

find_library(LOG_LIB log)

# 16 KB page sizes: NDK r27 only aligns to 16 KB when the app opts in with
# ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES (build.gradle passes it), and older NDKs
# ignore that flag, so the linker is told directly as well.
target_link_options(
        ${PACKAGE_NAME}
        PRIVATE
        "-Wl,-z,max-page-size=16384"
        "-Wl,-z,common-page-size=16384"
)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
)
