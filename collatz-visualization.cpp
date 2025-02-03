#ifdef __APPLE__
#include <GLUT/glut.h>
#else
#include <GL/glut.h>
#endif

#include "collatz-conjecture.h"
#include <cmath>
#include <string>
#include <unordered_map>
#include <vector>
#include <algorithm>

// -------------------------------------------------------------
// Global variables & toggles
// -------------------------------------------------------------
CollatzConjecture collatz;
std::unordered_map<int, std::vector<int>> collatzBranches;

int maxN = 0;

// Window size
const int WINDOW_WIDTH  = 1200;
const int WINDOW_HEIGHT = 800;

// Axis scaling
float maxIterations = 0.0f;
float maxValue      = 1.0f;

// Animation control
int  currentBranch  = 1;
int  currentIndex   = 0;
bool animationDone  = false;
bool animationPause = false;

// Animation speed
int ANIMATION_DELAY_MS = 50;

// Stats data structures
struct CollatzStats {
    int steps;
    int peak;
};

std::unordered_map<int, CollatzStats> collatzStatsMap;

// Option toggles
bool useLogScale   = false;
bool showHelp      = true;
bool instantRender = false;

// -------------------------------------------------------------
// Prompt mode for entering a new maxN on-screen
// -------------------------------------------------------------
bool promptForNewMaxN = false; // Are we currently prompting user for new input?
std::string inputBuffer;       // The characters typed by user.
std::string errorMessage;      // If the input is invalid, display error.

// -------------------------------------------------------------
// Forward declarations
// -------------------------------------------------------------
void computeAxisLimits();
void resetWithNewMaxN(int newN);
void display();
void timer(int = 0);

// -------------------------------------------------------------
// Utility & drawing functions
// -------------------------------------------------------------

void computeAxisLimits() {
    maxIterations = 0.0f;
    maxValue      = 1.0f;

    for (const auto& [start, values] : collatzBranches) {
        unsigned long size = values.size();

        if ((float) size > maxIterations)
            maxIterations = (float) size;

        for (int v : values)
            if ((float) v > maxValue)
                maxValue = static_cast<float>(v);
    }
}

// ------------------------------------------------------------------
// NEW: Adjust scaleX() so that the branch starting point (step 0)
//      is attached exactly to the y-axis line (drawn at x = -1.08),
//      and the last point maps to the right edge (x = 1.2).
// ------------------------------------------------------------------
float scaleX(int step) {
    // If there is only one point, return the y-axis line.
    if (maxIterations <= 1)
        return -1.08f;
    // Compute the available width from x = -1.08 to x = 1.2 (width = 2.28)
    float graphWidth = 1.2f - (-1.08f); // equals 2.28
    return -1.08f + ((float)step / ((float)maxIterations - 1.0f)) * graphWidth;
}

float scaleY(int value) {
    if (value <= 1)
        return -1.0f; // Ensure '1' is pinned at the bottom

    if (useLogScale) {
        float ratio = std::log2((float)value) / std::log2(maxValue);
        return (ratio * 2.0f) - 1.0f;
    } else
        return ((float)value / maxValue) * 2.0f - 1.0f;
}

void hsvToRgb(float H, float S, float V, float &r, float &g, float &b) {
    float C = V * S;
    float X = C * (1.0f - std::fabs(std::fmod(H / 60.0f, 2.0f) - 1.0f));
    float m = V - C;
    float rPrime, gPrime, bPrime;

    if (H < 60)       { rPrime = C; gPrime = X; bPrime = 0; }
    else if (H < 120) { rPrime = X; gPrime = C; bPrime = 0; }
    else if (H < 180) { rPrime = 0; gPrime = C; bPrime = X; }
    else if (H < 240) { rPrime = 0; gPrime = X; bPrime = C; }
    else if (H < 300) { rPrime = X; gPrime = 0; bPrime = C; }
    else              { rPrime = C; gPrime = 0; bPrime = X; }

    r = rPrime + m;
    g = gPrime + m;
    b = bPrime + m;
}

void getRainbowColor(int step, float &r, float &g, float &b) {
    float ratio = 0.0f;
    if (maxIterations > 1.0f)
        ratio = (static_cast<float>(step) / (maxIterations - 1.0f));
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
    float xPos = 0.46f;
    float yPos = 1.125f;

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
    drawLine("L   = Toggle log-scale vs. linear-scale");
    drawLine("R   = Clear screen & prompt for new maxN");
    drawLine("H   = Toggle this help menu");
    drawLine("I   = Toggle instant render mode");
}

void drawAxes() {
    glColor3f(1.0f, 1.0f, 1.0f);
    glLineWidth(2.0f);

    // X-axis
    glBegin(GL_LINES);
    glVertex2f(-1.2f, -1.0f);
    glVertex2f(1.2f, -1.0f);
    glEnd();

    // Y-axis
    glBegin(GL_LINES);
    glVertex2f(-1.08f, -1.1f);
    glVertex2f(-1.08f, 1.2f);
    glEnd();

    if (useLogScale) {
        for (int val = 1; val <= (int)maxValue; val *= 2) {
            float yPos = scaleY(val);
            drawText(-1.195f, yPos + 0.06f, std::to_string(val));
        }
    } else {
        if (maxValue >= 1.0f) {
            int increment = std::max(1, (int)maxValue / 8);
            for (int val = 0; val <= (int)maxValue; val += increment) {
                float yPos = scaleY(val);
                drawText(-1.195f, yPos + 0.06f, std::to_string(val));
            }
        }
    }
}

void drawIncrementalCollatzGraph() {
    // 1. Draw all completed branches with normal line style
    glLineWidth(2.0f);
    for (int branch = 1; branch < currentBranch; branch++) {
        auto it = collatzBranches.find(branch);
        if (it == collatzBranches.end()) continue;
        const auto &values = it->second;

        glBegin(GL_LINE_STRIP);
        for (size_t i = 0; i < values.size(); ++i) {
            float r, g, b;
            getRainbowColor((int)i, r, g, b);
            glColor3f(r, g, b);
            glVertex2f(scaleX((int)i), scaleY(values[i]));
        }
        glEnd();
    }

    // 2. Draw partial of the branch that is currently animating
    if (!animationDone) {
        auto it = collatzBranches.find(currentBranch);
        if (it != collatzBranches.end()) {
            const auto &values = it->second;

            // --- First Pass: Draw glow effect ---
            glLineWidth(8.0f);
            glEnable(GL_BLEND);
            glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
            glBegin(GL_LINE_STRIP);
            for (int i = 0; i <= currentIndex && i < (int)values.size(); ++i) {
                float r, g, b;
                getRainbowColor(i, r, g, b);
                glColor4f(r, g, b, 0.3f); // semi-transparent glow
                glVertex2f(scaleX(i), scaleY(values[i]));
            }
            glEnd();
            glDisable(GL_BLEND);

            // --- Second Pass: Draw the brightened current branch ---
            glLineWidth(5.0f);
            glBegin(GL_LINE_STRIP);
            for (int i = 0; i <= currentIndex && i < (int)values.size(); ++i) {
                float r, g, b;
                getRainbowColor(i, r, g, b);
                // Brighten line.
                r = std::min(r * 1.2f, 1.0f);
                g = std::min(g * 1.2f, 1.0f);
                b = std::min(b * 1.2f, 1.0f);
                glColor3f(r, g, b);
                glVertex2f(scaleX(i), scaleY(values[i]));
            }
            glEnd();

            glLineWidth(2.0f); // Restore line width to normal
        }
    }
}

// -------------------------------------------------------------
// MAIN display function (with on-screen prompt logic)
// -------------------------------------------------------------
void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glLoadIdentity();

    if (promptForNewMaxN) {
        glColor3f(1.0f, 1.0f, 1.0f);
        drawText(-0.5f, 0.0f, "Enter new maxN: " + inputBuffer);
        drawText(-0.5f, -0.07f, "[Press ENTER to confirm, ESC to cancel, BACKSPACE to edit]");

        // If there's an error, show it in red
        if (!errorMessage.empty()) {
            glColor3f(1.0f, 0.2f, 0.2f);
            drawText(-0.5f, 0.07f, "ERROR: " + errorMessage);
        }

        glutSwapBuffers();
        return;
    }

    // Normal chart display mode
    drawAxes();
    drawIncrementalCollatzGraph();

    // If still animating, display partial stats
    if (!animationDone) {
        CollatzStats currentSt = collatzStatsMap[currentBranch];
        int partialPeak = 1;
        const auto &values = collatzBranches[currentBranch];
        for (int i = 0; i <= currentIndex && i < (int)values.size(); i++) {
            if (values[i] > partialPeak) partialPeak = values[i];
        }

        glColor3f(1.0f, 1.0f, 0.0f);
        std::string msgBranch = "Animating Branch " + std::to_string(currentBranch)
                                + " / " + std::to_string(maxN)
                                + " | Total Steps=" + std::to_string(currentSt.steps)
                                + " | Partial Peak=" + std::to_string(partialPeak);
        drawText(-0.975f, 1.10f, msgBranch);
    }

    // Overall stats
    const auto& overallStats = collatz.getOverallStats(maxN);
    float avgSteps = (overallStats.branchesDone > 0)
                     ? (float)overallStats.sumOfSteps / (float) overallStats.branchesDone
                     : 0.0f;
    glColor3f(0.0f, 1.0f, 0.0f);
    std::string msgOverall = "Branches Done=" + std::to_string(overallStats.branchesDone)
                             + " | MaxSteps=" + std::to_string(overallStats.maxSteps)
                             + " | OverallPeak=" + std::to_string(overallStats.overallMaxPeak)
                             + " | AvgSteps=" + std::to_string((int)avgSteps);
    drawText(-0.975f, 1.04f, msgOverall);

    if (animationDone) {
        glColor3f(1.0f, 1.0f, 0.0f);
        drawText(-0.1f, 1.1f, "Animation Complete!");
    }

    // Help menu (top-right), if toggled on.
    if (showHelp) {
        drawHelpMenu();
    }

    // -----------------------------------------------------------------
    // NEW: Draw the animation delay & scale info near the bottom
    // -----------------------------------------------------------------
    glColor3f(1.0f, 1.0f, 1.0f);
    drawText(-0.7f, -1.10f,
             "Current animation delay: " + std::to_string(ANIMATION_DELAY_MS) + " ms");
    drawText(-0.7f, -1.15f,
             std::string("Using ")
             + (useLogScale ? "log" : "linear")
             + "-scale for Y-axis.");
    if (instantRender) {
        glColor3f(1.0f, 0.5f, 0.0f);
        drawText(-0.1f, -1.125f, "Instant Render Mode ON (Press 'I' to toggle)");
    }

    glutSwapBuffers();
}

// -------------------------------------------------------------
// RESET logic (clears the screen & stats, sets new maxN)
// -------------------------------------------------------------
void resetWithNewMaxN(int newN)
{
    // Make sure instant render is off, so we animate the new input
    instantRender = false;
    maxN = newN;

    // Clear everything and recompute the collatz sequences
    collatz = CollatzConjecture();
    collatz.computeCollatz(maxN);
    collatzBranches = collatz.getCollatzBranches();

    computeAxisLimits();

    // Populate stats
    collatzStatsMap.clear();
    for (const auto &pair : collatzBranches) {
        int startVal = pair.first;
        const auto &sequence = pair.second;

        CollatzStats s{};
        s.steps = (int)sequence.size() - 1;
        s.peak  = 1;
        for (int val : sequence)
            if (val > s.peak)
                s.peak = val;
        collatzStatsMap[startVal] = s;
    }

    // Reset animation state
    currentBranch = 1;
    currentIndex = 0;
    animationDone = false;

    // (Re)start the timer so that the animation begins immediately
    glutTimerFunc(ANIMATION_DELAY_MS, timer, 0);

    glutPostRedisplay();
}

// -------------------------------------------------------------
// TIMER callback
// -------------------------------------------------------------
void timer(int) {
    if (instantRender) {
        // If instant rendering is enabled, complete animation immediately
        animationDone = true;
        currentBranch = maxN + 1;
        currentIndex = 0;
    } else if (!animationDone && !animationPause && !promptForNewMaxN) {
        auto it = collatzBranches.find(currentBranch);
        if (it != collatzBranches.end()) {
            const auto &values = it->second;
            currentIndex++;
            if (currentIndex >= (int)values.size()) {
                currentIndex = 0;
                currentBranch++;
                if (currentBranch > maxN)
                    animationDone = true;
            }
        } else {
            currentBranch++;
            if (currentBranch > maxN)
                animationDone = true;
        }
    }

    glutPostRedisplay();
    if (!instantRender) {
        glutTimerFunc(ANIMATION_DELAY_MS, timer, 0);
    }
}

// -------------------------------------------------------------
// KEYBOARD callback
// -------------------------------------------------------------
void keyboard(unsigned char key, int, int)
{
    // If we are currently prompting for a new maxN:
    if (promptForNewMaxN) {
        switch (key) {
            case 27: // ESC
                // Cancel input (go back to the chart without changing maxN)
                promptForNewMaxN = false;
                inputBuffer.clear();
                errorMessage.clear();
                glutPostRedisplay();
                return;
            case '\r': // Return
            case '\n': // Enter
            {
                if (inputBuffer.empty()) {
                    // If empty, show an error message, remain in prompt mode
                    errorMessage = "Please enter a number (1..1000).";
                    glutPostRedisplay();
                    return;
                }

                int newValue = std::stoi(inputBuffer); // we only allow digits
                if (newValue < 1 || newValue > 1000) {
                    errorMessage = "Value out of range [1..1000]. Try again.";
                    glutPostRedisplay();
                    return;
                }

                // Turn off instant render and reset
                instantRender = false;
                errorMessage.clear();
                promptForNewMaxN = false;
                resetWithNewMaxN(newValue);
                inputBuffer.clear();

                glutPostRedisplay();
                return;
            }
            case 8: // Backspace (environment-dependent)
            case 127:
            {
                if (!inputBuffer.empty())
                    inputBuffer.pop_back();
                glutPostRedisplay();
                return;
            }
            default:
                // If digit, append to buffer
                if (key >= '0' && key <= '9') {
                    inputBuffer.push_back((char) key);
                    glutPostRedisplay();
                }
                return;
        }
    }
    else {
        switch (key) {
            case 27: // Escape
                exit(0);
            case 'p':
            case 'P':
                animationPause = !animationPause;
                break;
            case '+':
                ANIMATION_DELAY_MS = std::max(0, ANIMATION_DELAY_MS - 5);
                break;
            case '_':
                ANIMATION_DELAY_MS = std::min(100, ANIMATION_DELAY_MS + 5);
                break;
            case 'l':
            case 'L':
                useLogScale = !useLogScale;
                break;
            case 'r':
            case 'R':
                // Clear screen & prompt for new max number.
                instantRender = false;
                collatzBranches.clear();
                collatzStatsMap.clear();
                animationDone = true;
                promptForNewMaxN = true;
                inputBuffer.clear();
                errorMessage.clear();
                glutPostRedisplay();
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
                    currentBranch = maxN + 1;
                    currentIndex  = 0;
                } else {
                    animationDone = false;
                    currentBranch = 1;
                    currentIndex  = 0;
                    glutTimerFunc(ANIMATION_DELAY_MS, timer, 0);
                }
                glutPostRedisplay();
                break;
            default:
                break;
        }
    }
    glutPostRedisplay();
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
void initOpenGL() {
    glClearColor(0.05f, 0.05f, 0.1f, 1.0f);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(-1.2f, 1.2f, -1.2f, 1.2f);
    glMatrixMode(GL_MODELVIEW);
}

int main(int argc, char** argv) {
    maxN = 10;

    // Compute Collatz for initial maxN
    collatz.computeCollatz(maxN);
    collatzBranches = collatz.getCollatzBranches();
    computeAxisLimits();

    // Populate stats
    collatzStatsMap.clear();
    for (const auto &pair : collatzBranches) {
        int startVal = pair.first;
        const auto &sequence = pair.second;

        CollatzStats s{};
        s.steps = (int)sequence.size() - 1;
        s.peak  = 1;
        for (int val : sequence) {
            if (val > s.peak) s.peak = val;
        }
        collatzStatsMap[startVal] = s;
    }

    // Initialize GLUT
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    glutCreateWindow("Collatz Conjecture Chart Animation");

    initOpenGL();

    // Register callbacks
    glutDisplayFunc(display);
    glutKeyboardFunc(keyboard);
    glutTimerFunc(ANIMATION_DELAY_MS, timer, 0);

    // Start main loop
    glutMainLoop();
    return 0;
}
