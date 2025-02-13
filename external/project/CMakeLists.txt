# cmake_minimum_required(VERSION 3.10)
# project(cppVer)
# set(CMAKE_CXX_STANDARD 17)

# find_package(Python3 REQUIRED)
# execute_process(
#     COMMAND ${Python3_EXECUTABLE} -c "from openvino.utils import get_cmake_path; print(get_cmake_path(), end='')"
#     OUTPUT_VARIABLE OpenVINO_DIR_PY
#     ERROR_QUIET
# )

# find_package(OpenVINO REQUIRED PATHS "${OpenVINO_DIR_PY}")

# set(TARGET_NAME_PY test)

# add_executable(${TARGET_NAME_PY} src/main.cpp)

# # Add the include directory for OpenVINO
# target_include_directories(${TARGET_NAME_PY} PRIVATE ${OPENVINO_INCLUDE_DIRS})
# target_link_libraries(${TARGET_NAME_PY} PRIVATE openvino::runtime)



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


set(TARGET_NAME test)

add_executable(${TARGET_NAME} src/main.cpp)

include_directories(${OpenVINO_INCLUDE_DIRS})
include_directories(${OpenVINOGenAI_INCLUDE_DIRS})
# include_directories("C:\\Program Files (x86)\\Intel\\openvino_2024\\runtime\\include")
target_link_libraries(${TARGET_NAME} PRIVATE openvino::runtime openvino::genai nlohmann_json::nlohmann_json Boost::program_options)
