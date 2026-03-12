#ifdef __APPLE__
#include <GLUT/glut.h>
#else
#include <GL/glut.h>
#endif

#include "collatz_engine.h"
#include "collatz_modes.h"
#include "collatz_stats.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

// -------------------------------------------------------------
// Constants
// -------------------------------------------------------------

static constexpr int WINDOW_WIDTH = 1200;
static constexpr int WINDOW_HEIGHT = 800;

static constexpr float GRAPH_WIDTH = 2.28f;
static constexpr float DEFAULT_AXIS_X = -1.1f;
static constexpr float AXIS_DIGIT_OFFSET = 0.013f;
static constexpr float AXIS_LABEL_X = -1.19f;

static constexpr float GLOW_LINE_WIDTH = 8.0f;
static constexpr float BRIGHT_LINE_WIDTH = 5.0f;
static constexpr float DEFAULT_LINE_WIDTH = 2.0f;
static constexpr float BRIGHTNESS_BOOST = 1.2f;
static constexpr float GLOW_ALPHA = 0.3f;

static constexpr float BG_R = 0.05f;
static constexpr float BG_G = 0.05f;
static constexpr float BG_B = 0.1f;

static constexpr int DEFAULT_ANIMATION_DELAY_MS = 50;
static constexpr int ANIMATION_DELAY_STEP = 5;
static constexpr int MAX_ANIMATION_DELAY_MS = 100;
static constexpr int MIN_ANIMATION_DELAY_MS = 0;

static constexpr unsigned long long MAX_BULK_N = 40000;
static constexpr unsigned long long MAX_SELECTIVE_N = 500000;
static constexpr unsigned long long DEFAULT_N = 10;

// -------------------------------------------------------------
// Global state
// -------------------------------------------------------------

CollatzEngine engine;

std::unordered_map<unsigned long long, std::vector<unsigned long long>>
    collatzBranches;
std::unordered_map<unsigned long long, CollatzBranchStats> collatzStatsMap;

float verticalAxisPlacement = DEFAULT_AXIS_X;
float maxIterations = 0.0f;
float maxValue = 1.0f;

unsigned long long maxN = 0;
std::vector<unsigned long long> selectedBranches;

unsigned long long currentBranch = 1;
unsigned long long currentIndex = 0;
bool animationDone = false;
bool animationPause = false;
int animationDelayMs = DEFAULT_ANIMATION_DELAY_MS;

bool useYLogScale = false;
bool showHelp = true;
bool instantRender = false;
bool selectBranches = false;

bool promptForNewMaxN = false;
std::string inputBuffer;
std::string errorMessage;

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

void buildBranchStatsMap() {
  collatzStatsMap.clear();
  for (const auto &pair : collatzBranches) {
    CollatzBranchStats s{};
    s.steps = pair.second.size() - 1;
    s.branchPeak = 0;
    for (unsigned long long val : pair.second)
      s.branchPeak = std::max(s.branchPeak, val);
    collatzStatsMap[pair.first] = s;
  }
}

// -------------------------------------------------------------
// Drawing functions
// -------------------------------------------------------------

void computeAxisLimits() {
  maxIterations = 0.0f;
  maxValue = 1.0f;
  for (const auto &kv : collatzBranches) {
    auto size = static_cast<float>(kv.second.size());
    if (size > maxIterations)
      maxIterations = size;
    for (unsigned long long v : kv.second) {
      if (static_cast<float>(v) > maxValue)
        maxValue = static_cast<float>(v);
    }
  }
  int exponent = (maxValue > 10.0f)
                     ? static_cast<int>(std::floor(std::log10(maxValue)))
                     : 0;
  verticalAxisPlacement =
      (exponent > 0) ? DEFAULT_AXIS_X + static_cast<float>(exponent) * AXIS_DIGIT_OFFSET : DEFAULT_AXIS_X;
}

float scaleX(int step) {
  if (maxIterations <= 1.0f)
    return verticalAxisPlacement;
  float graphWidth = GRAPH_WIDTH;
  return verticalAxisPlacement +
         (static_cast<float>(step) / (maxIterations - 1.0f)) * graphWidth;
}

float scaleY(unsigned long long value) {
  if (value <= 1)
    return -1.0f;
  if (useYLogScale) {
    float ratio = std::log2(static_cast<float>(value)) / std::log2(maxValue);
    return (ratio * 2.0f) - 1.0f;
  }
  return (static_cast<float>(value) / maxValue) * 2.0f - 1.0f;
}

void hsvToRgb(float H, float S, float V, float &r, float &g, float &b) {
  float C = V * S;
  float X = C * (1.0f - std::fabs(std::fmod(H / 60.0f, 2.0f) - 1.0f));
  float m = V - C;
  float rPrime, gPrime, bPrime;
  if (H < 60) {
    rPrime = C;
    gPrime = X;
    bPrime = 0;
  } else if (H < 120) {
    rPrime = X;
    gPrime = C;
    bPrime = 0;
  } else if (H < 180) {
    rPrime = 0;
    gPrime = C;
    bPrime = X;
  } else if (H < 240) {
    rPrime = 0;
    gPrime = X;
    bPrime = C;
  } else if (H < 300) {
    rPrime = X;
    gPrime = 0;
    bPrime = C;
  } else {
    rPrime = C;
    gPrime = 0;
    bPrime = X;
  }
  r = rPrime + m;
  g = gPrime + m;
  b = bPrime + m;
}

void getRainbowColor(int step, float &r, float &g, float &b) {
  float ratio = (maxIterations > 1.0f)
                    ? static_cast<float>(step) / (maxIterations - 1.0f)
                    : 0.0f;
  ratio = std::min(std::max(ratio, 0.0f), 1.0f);
  float hue = 300.0f * ratio;
  hsvToRgb(hue, 1.0f, 1.0f, r, g, b);
}

void drawText(float x, float y, const std::string &text) {
  glRasterPos2f(x, y);
  for (char c : text)
    glutBitmapCharacter(GLUT_BITMAP_9_BY_15, c);
}

void drawHelpMenu() {
  float xPos = 0.46f, yPos = 1.125f;
  glColor3f(1.0f, 1.0f, 1.0f);
  auto drawLine = [&](const std::string &msg) {
    drawText(xPos, yPos, msg);
    yPos -= 0.05f;
  };
  drawLine("[Key Bindings]");
  drawLine("Esc = Quit");
  drawLine("P   = Pause/Resume");
  drawLine("+   = Speed up animation");
  drawLine("-   = Slow down animation");
  drawLine("L   = Toggle log-/linear-scale");
  drawLine("R   = Reset animation");
  drawLine("N   = Clear screen & prompt for new input");
  drawLine("H   = Toggle help menu");
  drawLine("I   = Toggle instant render mode");
  drawLine("M   = Toggle select branches mode");
}

void drawAxes() {
  glColor3f(1.0f, 1.0f, 1.0f);
  glLineWidth(2.0f);
  glBegin(GL_LINES);
  glVertex2f(-1.2f, -1.0f);
  glVertex2f(1.2f, -1.0f);
  glEnd();
  glBegin(GL_LINES);
  glVertex2f(verticalAxisPlacement, -1.1f);
  glVertex2f(verticalAxisPlacement, 1.2f);
  glEnd();

  if (useYLogScale) {
    for (int val = 1; val <= static_cast<int>(maxValue); val *= 2) {
      drawText(AXIS_LABEL_X, scaleY(val) + 0.05f, std::to_string(val));
    }
    return;
  }
  if (maxValue >= 1.0f) {
    int increment = std::max(1, static_cast<int>(maxValue) / 8);
    for (int val = 0; val <= static_cast<int>(maxValue); val += increment) {
      drawText(AXIS_LABEL_X, scaleY(val) + 0.05f, std::to_string(val));
    }
  }
}

void drawFullBranch(const std::vector<unsigned long long> &values) {
  glBegin(GL_LINE_STRIP);
  for (size_t j = 0; j < values.size(); j++) {
    float r, g, b;
    getRainbowColor(static_cast<int>(j), r, g, b);
    glColor3f(r, g, b);
    glVertex2f(scaleX(static_cast<int>(j)), scaleY(values[j]));
  }
  glEnd();
}

void drawAnimatedBranch(const std::vector<unsigned long long> &values,
                        unsigned long long branchIndex) {
  // Glow pass
  glLineWidth(GLOW_LINE_WIDTH);
  glEnable(GL_BLEND);
  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  glBegin(GL_LINE_STRIP);
  for (int i = 0; i <= branchIndex && i < static_cast<int>(values.size());
       i++) {
    float r, g, b;
    getRainbowColor(i, r, g, b);
    glColor4f(r, g, b, GLOW_ALPHA);
    glVertex2f(scaleX(i), scaleY(values[i]));
  }
  glEnd();
  glDisable(GL_BLEND);
  // Bright pass
  glLineWidth(BRIGHT_LINE_WIDTH);
  glBegin(GL_LINE_STRIP);
  for (int i = 0; i <= branchIndex && i < static_cast<int>(values.size());
       i++) {
    float r, g, b;
    getRainbowColor(i, r, g, b);
    r = std::min(r * BRIGHTNESS_BOOST, 1.0f);
    g = std::min(g * BRIGHTNESS_BOOST, 1.0f);
    b = std::min(b * BRIGHTNESS_BOOST, 1.0f);
    glColor3f(r, g, b);
    glVertex2f(scaleX(i), scaleY(values[i]));
  }
  glEnd();
  glLineWidth(DEFAULT_LINE_WIDTH);
}

void drawSelectiveCompletedBranches() {
  for (size_t i = 0; i < currentBranch && i < selectedBranches.size(); i++) {
    unsigned long long branchNum = selectedBranches[i];
    auto it = collatzBranches.find(branchNum);
    if (it == collatzBranches.end())
      continue;
    drawFullBranch(it->second);
  }
}

void drawSelectiveAnimatingBranch() {
  if (animationDone || currentBranch >= selectedBranches.size())
    return;
  unsigned long long branchNum = selectedBranches[currentBranch];
  auto it = collatzBranches.find(branchNum);
  if (it == collatzBranches.end())
    return;
  drawAnimatedBranch(it->second, currentIndex);
}

void drawBulkCompletedBranches() {
  for (unsigned long long branch = 1; branch < currentBranch; branch++) {
    auto it = collatzBranches.find(branch);
    if (it == collatzBranches.end())
      continue;
    drawFullBranch(it->second);
  }
}

void drawBulkAnimatingBranch() {
  if (animationDone)
    return;
  auto it = collatzBranches.find(currentBranch);
  if (it == collatzBranches.end())
    return;
  drawAnimatedBranch(it->second, currentIndex);
}

void drawIncrementalCollatzGraph() {
  if (selectBranches) {
    drawSelectiveCompletedBranches();
    drawSelectiveAnimatingBranch();
  } else {
    drawBulkCompletedBranches();
    drawBulkAnimatingBranch();
  }
}

void drawPrompt() {
  glColor3f(1.0f, 1.0f, 1.0f);
  if (selectBranches)
    drawText(-0.5f, 0.0f,
             "Enter branch numbers (comma separated): " + inputBuffer);
  else
    drawText(-0.5f, 0.0f, "Enter new maxN: " + inputBuffer);
  drawText(-0.5f, -0.07f,
           "[Press ENTER to confirm, ESC to cancel, BACKSPACE to edit]");
  if (!errorMessage.empty()) {
    glColor3f(1.0f, 0.2f, 0.2f);
    drawText(-0.5f, 0.07f, "ERROR: " + errorMessage);
  }
}

unsigned long long getPartialPeak(const std::vector<unsigned long long> &values,
                                  unsigned long long branchIndex) {
  unsigned long long peak = 0;
  for (int i = 0; i <= branchIndex && i < static_cast<int>(values.size());
       i++) {
    peak = std::max(peak, values[i]);
  }
  return peak;
}

void drawStatistics() {
  // Draw current branch info.
  if (!animationDone) {
    if (selectBranches && currentBranch < selectedBranches.size()) {
      unsigned long long branchNum = selectedBranches[currentBranch];
      const auto &stats = collatzStatsMap[branchNum];
      unsigned long long partialPeak =
          getPartialPeak(collatzBranches[branchNum], currentIndex);
      glColor3f(1.0f, 1.0f, 0.0f);
      std::string msg = "Animating Branch " + std::to_string(branchNum) +
                        " / " + std::to_string(selectedBranches.size()) +
                        " | Total Steps=" + std::to_string(stats.steps) +
                        " | Partial Peak=" + std::to_string(partialPeak);
      drawText(-0.975f, 1.10f, msg);
    } else if (!selectBranches) {
      const auto &stats = collatzStatsMap[currentBranch];
      unsigned long long partialPeak =
          getPartialPeak(collatzBranches[currentBranch], currentIndex);
      glColor3f(1.0f, 1.0f, 0.0f);
      std::string msg = "Animating Branch " + std::to_string(currentBranch) +
                        " / " + std::to_string(maxN) +
                        " | Total Steps=" + std::to_string(stats.steps) +
                        " | Partial Peak=" + std::to_string(partialPeak);
      drawText(-0.975f, 1.10f, msg);
    }
  }

  // Draw overall statistics.
  if (selectBranches) {
    unsigned long long branchesDone = selectedBranches.size();
    unsigned long long sumSteps = 0, maxSteps = 0, overallPeak = 0;
    for (unsigned long long branchNum : selectedBranches) {
      const auto &s = collatzStatsMap[branchNum];
      sumSteps += s.steps;
      maxSteps = std::max(maxSteps, s.steps);
      overallPeak = std::max(overallPeak, s.branchPeak);
    }
    unsigned long long avgSteps =
        (branchesDone > 0) ? sumSteps / branchesDone : 0;
    glColor3f(0.0f, 1.0f, 0.0f);
    std::string msg = "Branches=" + std::to_string(branchesDone) +
                      " | MaxSteps=" + std::to_string(maxSteps) +
                      " | OverallPeak=" + std::to_string(overallPeak) +
                      " | AvgSteps=" + std::to_string(avgSteps);
    drawText(-0.975f, 1.04f, msg);
  } else {
    CollatzOverallStats overallStats{};
    overallStats.branchesDone = collatzBranches.size();
    overallStats.sumOfSteps = 0;
    overallStats.maxSteps = 0;
    overallStats.overallMaxPeak = 0;
    for (const auto &p : collatzStatsMap) {
      overallStats.sumOfSteps += p.second.steps;
      overallStats.maxSteps = std::max(overallStats.maxSteps, p.second.steps);
      overallStats.overallMaxPeak =
          std::max(overallStats.overallMaxPeak, p.second.branchPeak);
    }
    unsigned long long avgSteps =
        (overallStats.branchesDone > 0)
            ? overallStats.sumOfSteps / overallStats.branchesDone
            : 0;
    glColor3f(0.0f, 1.0f, 0.0f);
    std::string msg =
        "Branches=" + std::to_string(overallStats.branchesDone) +
        " | MaxSteps=" + std::to_string(overallStats.maxSteps) +
        " | OverallPeak=" + std::to_string(overallStats.overallMaxPeak) +
        " | AvgSteps=" + std::to_string(avgSteps);
    drawText(-0.975f, 1.04f, msg);
  }
}

void drawBottomInfo() {
  glColor3f(1.0f, 1.0f, 1.0f);
  drawText(-0.7f, -1.10f,
           "Current animation delay: " + std::to_string(animationDelayMs) +
               " ms");
  drawText(-0.7f, -1.15f,
           std::string("Using ") + (useYLogScale ? "log" : "linear") +
               "-scale for Y-axis.");
  if (instantRender) {
    glColor3f(1.0f, 0.5f, 0.0f);
    drawText(-0.1f, -1.125f, "Instant Render Mode ON (Press 'I' to toggle)");
  }
}

// -------------------------------------------------------------
// Animation update functions
// -------------------------------------------------------------
void updateSelectiveAnimation() {
  if (currentBranch >= selectedBranches.size()) {
    animationDone = true;
    return;
  }
  unsigned long long branchNum = selectedBranches[currentBranch];
  auto it = collatzBranches.find(branchNum);
  if (it == collatzBranches.end()) {
    currentBranch++;
    if (currentBranch >= selectedBranches.size())
      animationDone = true;
    return;
  }
  const auto &values = it->second;
  currentIndex++;
  if (currentIndex >= values.size()) {
    currentIndex = 0;
    currentBranch++;
    if (currentBranch >= selectedBranches.size())
      animationDone = true;
  }
}

void updateBulkAnimation() {
  auto it = collatzBranches.find(currentBranch);
  if (it == collatzBranches.end()) {
    currentBranch++;
    if (currentBranch > maxN)
      animationDone = true;
    return;
  }
  const auto &values = it->second;
  currentIndex++;
  if (currentIndex >= values.size()) {
    currentIndex = 0;
    currentBranch++;
    if (currentBranch > maxN)
      animationDone = true;
  }
}

void timer(int) {
  if (instantRender) {
    animationDone = true;
    currentIndex = 0;
    currentBranch = (selectBranches) ? selectedBranches.size() : maxN + 1;
  } else if (!animationDone && !animationPause && !promptForNewMaxN) {
    if (selectBranches)
      updateSelectiveAnimation();
    else
      updateBulkAnimation();
  }
  glutPostRedisplay();
  if (!instantRender)
    glutTimerFunc(animationDelayMs, timer, 0);
}

// -------------------------------------------------------------
// Reset and Input Processing functions
// -------------------------------------------------------------
void resetWithNewMaxN(unsigned long long newN) {
  instantRender = false;
  collatzBranches.clear();
  collatzStatsMap.clear();

  if (selectBranches) {
    auto result = computeSelectiveSequences(engine, selectedBranches);
    collatzBranches = std::move(result.branches);
    collatzStatsMap = std::move(result.branchStats);
    currentBranch = 0;
  } else {
    maxN = newN;
    auto result = computeBulkSequences(engine, maxN);
    collatzBranches = std::move(result.branches);
    buildBranchStatsMap();
    currentBranch = 1;
  }
  computeAxisLimits();
  currentIndex = 0;
  animationDone = false;
  glutTimerFunc(animationDelayMs, timer, 0);
  glutPostRedisplay();
}

void processSelectiveInput() {
  std::vector<unsigned long long> branches;
  std::istringstream tokenStream(inputBuffer);
  std::string token;
  while (std::getline(tokenStream, token, ',')) {
    token.erase(std::remove_if(token.begin(), token.end(), ::isspace),
                token.end());
    if (token.empty())
      continue;
    try {
      unsigned long long val = std::stoll(token);
      if (val < 1 || val > MAX_SELECTIVE_N) {
        errorMessage = "Branch numbers must be in [1.." + std::to_string(MAX_SELECTIVE_N) + "].";
        return;
      }
      branches.push_back(val);
    } catch (...) {
      errorMessage = "Invalid input. Please enter comma-separated numbers.";
      return;
    }
  }
  if (branches.empty()) {
    errorMessage = "No valid branch numbers entered.";
    return;
  }
  std::sort(branches.begin(), branches.end());
  branches.erase(std::unique(branches.begin(), branches.end()), branches.end());
  selectedBranches = branches;
  errorMessage.clear();
  promptForNewMaxN = false;
  inputBuffer.clear();
  resetWithNewMaxN(0);
}

void processBulkInput() {
  try {
    int newValue = std::stoi(inputBuffer);
    if (newValue < 1 || newValue > static_cast<int>(MAX_BULK_N)) {
      errorMessage = "Value out of range [1.." + std::to_string(MAX_BULK_N) + "]. Try again.";
      return;
    }
    instantRender = false;
    errorMessage.clear();
    promptForNewMaxN = false;
    resetWithNewMaxN(newValue);
    inputBuffer.clear();
  } catch (...) {
    errorMessage = "Invalid input.";
  }
}

void handlePromptKey(unsigned char key) {
  switch (key) {
  case 27: // ESC
    promptForNewMaxN = false;
    inputBuffer.clear();
    errorMessage.clear();
    if (selectBranches) {
      selectedBranches.clear();
      for (unsigned long long i = 1; i <= DEFAULT_N; i++)
        selectedBranches.push_back(i);
      resetWithNewMaxN(selectedBranches.back());
    } else {
      resetWithNewMaxN(DEFAULT_N);
    }
    selectBranches = false;
    break;
  case '\r':
  case '\n':
    if (inputBuffer.empty()) {
      errorMessage =
          selectBranches
              ? "Please enter at least one branch number (e.g., 3,7,10)."
              : "Please enter a number (1.." + std::to_string(MAX_BULK_N) + ").";
    } else if (selectBranches)
      processSelectiveInput();
    else
      processBulkInput();
    break;
  case 8: // Backspace
  case 127:
    if (!inputBuffer.empty())
      inputBuffer.pop_back();
    break;
  default:
    if ((key >= '0' && key <= '9') || key == ',' || std::isspace(key))
      inputBuffer.push_back((char)key);
    break;
  }
  glutPostRedisplay();
}

void handleNormalKey(unsigned char key) {
  switch (key) {
  case 27:
    exit(0);
  case 'p':
  case 'P':
    animationPause = !animationPause;
    break;
  case '+':
    animationDelayMs = std::max(MIN_ANIMATION_DELAY_MS, animationDelayMs - ANIMATION_DELAY_STEP);
    break;
  case '-':
  case '_':
    animationDelayMs = std::min(MAX_ANIMATION_DELAY_MS, animationDelayMs + ANIMATION_DELAY_STEP);
    break;
  case 'l':
  case 'L':
    useYLogScale = !useYLogScale;
    break;
  case 'r':

  case 'R':
    if (selectBranches)
      currentBranch = 0;
    else
      currentBranch = 1;
    currentIndex = 0;
    animationDone = false;
    glutTimerFunc(animationDelayMs, timer, 0);
    break;
  case 'n':
  case 'N':
    instantRender = false;
    selectBranches = false;
    collatzBranches.clear();
    collatzStatsMap.clear();
    animationDone = true;
    promptForNewMaxN = true;
    inputBuffer.clear();
    errorMessage.clear();
    break;
  case 'h':
  case 'H':
    showHelp = !showHelp;
    break;
  case 'i':
  case 'I':
    instantRender = !instantRender;
    if (instantRender) {
      animationDone = true;
      currentBranch = (selectBranches) ? selectedBranches.size() : maxN + 1;
      currentIndex = 0;
    } else {
      animationDone = false;
      currentBranch = (selectBranches) ? 0 : 1;
      currentIndex = 0;
      glutTimerFunc(animationDelayMs, timer, 0);
    }
    break;
  case 'm':
  case 'M':
    selectBranches = !selectBranches;
    promptForNewMaxN = true;
    inputBuffer.clear();
    errorMessage.clear();
    if (selectBranches) {
      selectedBranches.clear();
      for (unsigned long long i = 1; i <= DEFAULT_N; i++)
        selectedBranches.push_back(i);
    }
    break;
  default:
    break;
  }
  glutPostRedisplay();
}

void keyboard(unsigned char key, int, int) {
  if (promptForNewMaxN)
    handlePromptKey(key);
  else
    handleNormalKey(key);
  glutPostRedisplay();
}

void initOpenGL() {
  glClearColor(BG_R, BG_G, BG_B, 1.0f);
  glMatrixMode(GL_PROJECTION);
  glLoadIdentity();
  gluOrtho2D(-1.2f, 1.2f, -1.2f, 1.2f);
  glMatrixMode(GL_MODELVIEW);
}

// -------------------------------------------------------------
// Main display function
// -------------------------------------------------------------
void display() {
  glClear(GL_COLOR_BUFFER_BIT);
  glLoadIdentity();

  if (promptForNewMaxN) {
    drawPrompt();
    glutSwapBuffers();
    return;
  }

  drawAxes();
  drawIncrementalCollatzGraph();
  drawStatistics();
  if (animationDone) {
    glColor3f(1.0f, 1.0f, 0.0f);
    drawText(-0.1f, 1.1f, "Animation Complete!");
  }
  if (showHelp)
    drawHelpMenu();
  drawBottomInfo();
  glutSwapBuffers();
}

// -------------------------------------------------------------
// Main function
// -------------------------------------------------------------
int main(int argc, char **argv) {
  maxN = DEFAULT_N;
  auto bulkResult = computeBulkSequences(engine, maxN);
  collatzBranches = std::move(bulkResult.branches);
  buildBranchStatsMap();
  computeAxisLimits();

  glutInit(&argc, argv);
  glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
  glutInitWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT);
  glutCreateWindow("Collatz Conjecture Visualization");

  initOpenGL();
  glutDisplayFunc(display);
  glutKeyboardFunc(keyboard);
  glutTimerFunc(animationDelayMs, timer, 0);
  glutMainLoop();
  return 0;
}
