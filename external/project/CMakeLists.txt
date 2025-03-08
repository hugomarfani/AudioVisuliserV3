cmake_minimum_required(VERSION 3.10)
project(cppVer)
set(CMAKE_CXX_STANDARD 20)

find_package(OpenVINO REQUIRED)
find_package (OpenVINOGenAI REQUIRED)

include(FetchContent)

FetchContent_Declare(nlohmann_json URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz)
FetchContent_MakeAvailable(nlohmann_json)

set(BOOST_INCLUDE_LIBRARIES thread filesystem system program_options)
set(BOOST_ENABLE_CMAKE ON)
FetchContent_Declare(
  Boost
  GIT_REPOSITORY https://github.com/boostorg/boost.git
  GIT_TAG boost-1.80.0
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(Boost)

if(NOT TARGET dr_libs)
    FetchContent_Declare(dr_libs
        URL https://github.com/mackron/dr_libs/archive/da35f9d6c7374a95353fd1df1d394d44ab66cf01.tar.gz
        URL_HASH SHA256=2704d347f480ca1bc92233fb01747e4550cc8031735b6ea62ca9990ebb8851ae)
    FetchContent_MakeAvailable(dr_libs)
endif()

# Fetch libsamplerate
FetchContent_Declare(
    libsamplerate
    GIT_REPOSITORY https://github.com/libsndfile/libsamplerate.git
    GIT_TAG master
)
FetchContent_MakeAvailable(libsamplerate)

# # Fetch ONNX Runtime
# FetchContent_Declare(
#     onnxruntime
#     GIT_REPOSITORY https://github.com/microsoft/onnxruntime.git
#     GIT_TAG v1.16.0  # Latest stable version
# )
# FetchContent_MakeAvailable(onnxruntime)

# # Fetch stb_image_write for saving images
# FetchContent_Declare(
#     stb
#     GIT_REPOSITORY https://github.com/nothings/stb.git
#     GIT_TAG master
# )
# FetchContent_MakeAvailable(stb)


set(TARGET_NAME cppVer)

add_executable(${TARGET_NAME} src/main.cpp src/audio_utils.cpp src/imwrite.cpp)

include_directories(${OpenVINO_INCLUDE_DIRS})
include_directories(${OpenVINOGenAI_INCLUDE_DIRS})
target_link_libraries(${TARGET_NAME} PRIVATE openvino::runtime openvino::genai nlohmann_json::nlohmann_json Boost::program_options samplerate)
target_include_directories(${TARGET_NAME} PRIVATE "$<BUILD_INTERFACE:${dr_libs_SOURCE_DIR}>")

# # Include ONNX Runtime and stb_image_write headers
# target_include_directories(stable_diffusion PRIVATE ${onnxruntime_SOURCE_DIR}/include ${stb_SOURCE_DIR})

# # Link ONNX Runtime
# target_link_libraries(stable_diffusion PRIVATE onnxruntime)
