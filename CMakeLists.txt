cmake_minimum_required(VERSION 3.20)
project(CollatzConjectureVisualization)

set(CMAKE_CXX_STANDARD 17)

find_package(OpenGL REQUIRED)
find_package(GLUT REQUIRED)

add_executable(CollatzConjecture collatz-conjecture.cpp collatz-visualization.cpp)

target_link_libraries(CollatzConjecture OpenGL::GL GLUT::GLUT)
