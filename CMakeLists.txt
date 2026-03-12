cmake_minimum_required(VERSION 3.20)
project(CollatzConjectureVisualization LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenGL REQUIRED)
find_package(GLUT REQUIRED)

add_executable(CollatzConjecture
        collatz-visualization.cpp
        collatz_modes.cpp)

target_include_directories(CollatzConjecture PRIVATE ${OPENGL_INCLUDE_DIRS} ${GLUT_INCLUDE_DIRS})
target_link_libraries(CollatzConjecture OpenGL::GL GLUT::GLUT)

if(APPLE)
    target_compile_definitions(CollatzConjecture PRIVATE GL_SILENCE_DEPRECATION)
endif()
