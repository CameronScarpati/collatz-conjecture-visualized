#define GL_SILENCE_DEPRECATION
#ifdef __APPLE__
#include <GLUT/glut.h>
#else
#include <GL/glut.h>
#endif

#include "collatz-conjecture.h"
#include <iostream>
#include <cmath>
#include <string>
#include <unordered_map>
#include <vector>

// ------------------------------------------------------------------
// Global variables & toggles
// ------------------------------------------------------------------
CollatzConjecture collatz;
std::unordered_map<int, std::vector<int>> collatzTree;

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
int ANIMATION_DELAY_MS = 30;

// Stats data structures
struct CollatzStats {
    int steps;
    int peak;
};

std::unordered_map<int, CollatzStats> collatzStatsMap;
int overallMaxPeak = 1;
int sumOfSteps     = 0;
int maxSteps       = 0;
int branchesDone   = 0;

// Option toggles
bool useLogScale   = true;
bool showHelp      = true;

// ------------------------------------------------------------------
// Prompt mode for entering a new maxN on-screen
// ------------------------------------------------------------------
bool        promptForNewMaxN = false;   // are we currently prompting user for new input?
std::string inputBuffer;                // the characters typed by user
std::string errorMessage;               // if out-of-range input, display error

// ------------------------------------------------------------------
// Forward declarations
// ------------------------------------------------------------------
void computeAxisLimits();
void resetWithNewMaxN(int newN);
void display();
void timer(int = 0);

// ------------------------------------------------------------------
// Utility & drawing functions
// ------------------------------------------------------------------

void computeAxisLimits() {
    maxIterations = 0.0f;
    maxValue      = 1.0f;
    for (const auto& [start, values] : collatzTree) {
        auto size = static_cast<float>(values.size());
        if (size > maxIterations) {
            maxIterations = size;
        }
        for (int v : values) {
            if (v > maxValue) {
                maxValue = static_cast<float>(v);
            }
        }
    }
}

float scaleX(int step) {
    if (maxIterations == 0) return 0.0f;
    return (step / maxIterations) * 2.0f - 1.0f;
}

float scaleY(int value) {
    // Always pin value <= 1 to the bottom.
    if (value <= 1) {
        return -1.0f;
    }

    if (useLogScale) {
        // Normal log-scale formula
        float ratio = std::log2((float)value) / std::log2(maxValue);
        return ratio * 2.0f - 1.0f;
    }
    else {
        // Linear scale as before
        return (static_cast<float>(value) / maxValue) * 2.0f - 1.0f;
    }
}

void hsvToRgb(float H, float S, float V, float &r, float &g, float &b) {
    float C = V * S;
    float X = C * (1.0f - std::fabs(std::fmod(H / 60.0f, 2.0f) - 1.0f));
    float m = V - C;
    float rPrime, gPrime, bPrime;

    if      (H < 60)  { rPrime = C; gPrime = X; bPrime = 0; }
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
    if (maxIterations > 1.0f) {
        ratio = (static_cast<float>(step) / (maxIterations - 1.0f));
    }
    if (ratio < 0.0f) ratio = 0.0f;
    if (ratio > 1.0f) ratio = 1.0f;

    float hue = 300.0f * ratio;
    hsvToRgb(hue, 1.0f, 1.0f, r, g, b);
}

void drawText(float x, float y, const std::string &text) {
    glRasterPos2f(x, y);
    for (char c : text) {
        glutBitmapCharacter(GLUT_BITMAP_9_BY_15, c);
    }
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
}

void drawAxes() {
    glColor3f(1.0f, 1.0f, 1.0f);
    glLineWidth(2.0f);

    // X-axis
    glBegin(GL_LINES);
    glVertex2f(-1.2f, -1.0f);
    glVertex2f( 1.2f, -1.0f);
    glEnd();

    // Y-axis
    glBegin(GL_LINES);
    glVertex2f(-1.0f, -1.2f);
    glVertex2f(-1.0f,  1.2f);
    glEnd();

    // X-axis arrow
    glBegin(GL_TRIANGLES);
    glVertex2f(1.2f,  -1.0f);
    glVertex2f(1.15f, -0.97f);
    glVertex2f(1.15f, -1.03f);
    glEnd();

    // Y-axis arrow
    glBegin(GL_TRIANGLES);
    glVertex2f(-1.0f,  1.2f);
    glVertex2f(-1.03f, 1.15f);
    glVertex2f(-0.97f, 1.15f);
    glEnd();

    // X-axis labels
    if (maxIterations > 0) {
        int stepInterval = std::max(5, (int)maxIterations / 10);
        for (int i = 0; i <= (int)maxIterations; i += stepInterval) {
            float xPos = scaleX(i);
            drawText(xPos, -1.05f, std::to_string(i));
        }
    }

    // Y-axis labels
    if (useLogScale) {
        // powers of 2
        for (int val = 1; val <= (int)maxValue; val *= 2) {
            float yPos = scaleY(val);
            drawText(-1.08f, yPos, std::to_string(val));
        }
    } else {
        // linear intervals
        if (maxValue >= 1.0f) {
            int increment = std::max(1, (int)maxValue / 8);
            for (int val = 0; val <= (int)maxValue; val += increment) {
                float yPos = scaleY(val);
                drawText(-1.08f, yPos, std::to_string(val));
            }
        }
    }

    // Axis descriptions
    drawText(1.25f, -1.02f, "Steps");
    drawText(-1.05f, 1.25f,  "Value");
}

void drawIncrementalCollatzGraph() {
    // 1. Draw all completed branches with normal line style
    glLineWidth(2.0f);
    for (int branch = 1; branch < currentBranch; branch++) {
        auto it = collatzTree.find(branch);
        if (it == collatzTree.end()) continue;
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
        auto it = collatzTree.find(currentBranch);
        if (it != collatzTree.end()) {
            const auto &values = it->second;

            // Make the current branch thicker
            glLineWidth(5.0f);

            // Optionally begin a new color
            // glColor3f(1.0f, 1.0f, 0.0f); // for a solid highlight color
            // But let's just keep the rainbow color and maybe intensify it

            glBegin(GL_LINE_STRIP);
            for (int i = 0; i <= currentIndex && i < (int)values.size(); ++i) {
                float r, g, b;
                getRainbowColor(i, r, g, b);
                // optionally brighten the color a bit
                // e.g., clamp them in [0,1], or multiply by factor
                r = std::min(r * 1.2f, 1.0f);
                g = std::min(g * 1.2f, 1.0f);
                b = std::min(b * 1.2f, 1.0f);

                glColor3f(r, g, b);
                glVertex2f(scaleX(i), scaleY(values[i]));
            }
            glEnd();

            // Restore line width to normal
            glLineWidth(2.0f);
        }
    }
}

// ------------------------------------------------------------------
// MAIN display function (with on-screen prompt logic)
// ------------------------------------------------------------------
void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glLoadIdentity();

    // If we are prompting for new maxN, draw the overlay.
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

    // -- Normal chart display mode --
    drawAxes();
    drawIncrementalCollatzGraph();

    // If still animating, partial stats
    if (!animationDone) {
        CollatzStats currentSt = collatzStatsMap[currentBranch];
        int partialPeak = 1;
        const auto &vals = collatzTree[currentBranch];
        for (int i = 0; i <= currentIndex && i < (int)vals.size(); i++) {
            if (vals[i] > partialPeak) partialPeak = vals[i];
        }

        glColor3f(1.0f, 1.0f, 0.0f);
        std::string msgBranch = "Animating Branch " + std::to_string(currentBranch)
                                + " / " + std::to_string(maxN)
                                + " | Total Steps=" + std::to_string(currentSt.steps)
                                + " | Partial Peak=" + std::to_string(partialPeak);
        drawText(-0.975f, 1.10f, msgBranch);
    }

    // Overall stats
    float avgSteps = (branchesDone > 0)
                     ? (float)sumOfSteps / (float)branchesDone
                     : 0.0f;

    glColor3f(0.0f, 1.0f, 0.0f);
    std::string msgOverall = "Branches Done=" + std::to_string(branchesDone)
                             + " | MaxSteps=" + std::to_string(maxSteps)
                             + " | OverallPeak=" + std::to_string(overallMaxPeak)
                             + " | AvgSteps=" + std::to_string((int)avgSteps);
    drawText(-0.975f, 1.04f, msgOverall);

    if (animationDone) {
        glColor3f(1.0f, 1.0f, 0.0f);
        drawText(-0.1f, 1.1f, "Animation Complete!");
    }

    // Help menu (top-right), if toggled on
    if (showHelp) {
        drawHelpMenu();
    }

    // ----------------------------------------------------------------------
    // NEW: Draw the animation delay & scale info near the bottom
    // ----------------------------------------------------------------------
    glColor3f(1.0f, 1.0f, 1.0f);
    // For example, place them at x=-1.15, y ~ -1.10 and -1.15 so it doesn’t overlap the axis
    drawText(-0.2f, -1.10f,
             "Current animation delay: " + std::to_string(ANIMATION_DELAY_MS) + " ms");
    drawText(-0.2f, -1.15f,
             std::string("Using ")
             + (useLogScale ? "log" : "linear")
             + "-scale for Y-axis.");

    glutSwapBuffers();
}

// ------------------------------------------------------------------
// RESET logic (clears the screen & stats, sets new maxN)
// ------------------------------------------------------------------
void resetWithNewMaxN(int newN)
{
    if (newN < 1) {
        std::cerr << "Invalid input! Must be >= 1.\n";
        return;
    }
    maxN = newN;

    // Clear everything
    collatz = CollatzConjecture();
    collatz.computeCollatz(maxN);
    collatzTree = collatz.getCollatzTree();

    computeAxisLimits();

    // Populate stats
    collatzStatsMap.clear();
    for (const auto &pair : collatzTree) {
        int startVal = pair.first;
        const auto &sequence = pair.second;

        CollatzStats s{};
        s.steps = (int)sequence.size() - 1;
        s.peak  = 1;
        for (int val : sequence) {
            if (val > s.peak) {
                s.peak = val;
            }
        }
        collatzStatsMap[startVal] = s;
    }

    // Reset animation state
    currentBranch  = 1;
    currentIndex   = 0;
    animationDone  = false;
    branchesDone   = 0;
    sumOfSteps     = 0;
    maxSteps       = 0;
    overallMaxPeak = 1;

    glutPostRedisplay();
}

// ------------------------------------------------------------------
// TIMER callback
// ------------------------------------------------------------------
void timer(int) {
    // Don't animate if we're prompting the user for new input
    if (!animationDone && !animationPause && !promptForNewMaxN) {
        auto it = collatzTree.find(currentBranch);
        if (it != collatzTree.end()) {
            const auto &values = it->second;
            currentIndex++;
            if (currentIndex >= (int)values.size()) {
                // Finished this branch
                branchesDone++;

                // Update overall stats
                auto st = collatzStatsMap[currentBranch];
                sumOfSteps += st.steps;
                if (st.steps > maxSteps) {
                    maxSteps = st.steps;
                }
                if (st.peak > overallMaxPeak) {
                    overallMaxPeak = st.peak;
                }

                // Move to next
                currentIndex = 0;
                currentBranch++;
                if (currentBranch > maxN) {
                    animationDone = true;
                }
            }
        } else {
            // If no data for this branch, skip it
            currentBranch++;
            if (currentBranch > maxN) {
                animationDone = true;
            }
        }
    }

    glutPostRedisplay();
    glutTimerFunc(ANIMATION_DELAY_MS, timer, 0);
}

// ------------------------------------------------------------------
// KEYBOARD callback
// ------------------------------------------------------------------
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

                // Enter/Return
            case '\r':
            case '\n':
            {
                // Attempt to parse input
                if (inputBuffer.empty()) {
                    // If empty, show an error message, remain in prompt mode
                    errorMessage = "Please enter a number (1..1000).";
                    glutPostRedisplay();
                    return;
                }

                int newValue = std::stoi(inputBuffer); // we only allow digits
                if (newValue < 1 || newValue > 1000) {
                    // Out of range
                    errorMessage = "Value out of range [1..1000]. Try again.";
                    glutPostRedisplay();
                    return;
                }

                // Valid input, reset and exit prompt mode
                errorMessage.clear();
                promptForNewMaxN = false;
                resetWithNewMaxN(newValue);
                inputBuffer.clear();

                glutPostRedisplay();
                return;
            }

                // Backspace can be ASCII 8 or 127, depending on environment
            case 8:
            case 127:
            {
                if (!inputBuffer.empty()) {
                    inputBuffer.pop_back();
                }
                glutPostRedisplay();
                return;
            }

            default:
                // If digit, append to buffer
                if (key >= '0' && key <= '9') {
                    inputBuffer.push_back(key);
                    glutPostRedisplay();
                }
                // else ignore
                return;
        }
    }
    else {
        // Normal mode (not prompting for input)
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
            case '-':
                ANIMATION_DELAY_MS = std::min(60, ANIMATION_DELAY_MS + 5);
                break;
            case 'l':
            case 'L':
                useLogScale = !useLogScale;
                break;
            case 'r':
            case 'R':
                // Clear screen & prompt for new maxN
                collatzTree.clear();
                collatzStatsMap.clear();
                animationDone   = true;  // stop current animation
                promptForNewMaxN = true; // start prompting user
                inputBuffer.clear();
                errorMessage.clear();
                glutPostRedisplay();
                break;
            case 'h':
            case 'H':
                showHelp = !showHelp;
                break;
            default:
                break;
        }
    }

    glutPostRedisplay();
}

// ------------------------------------------------------------------
// Initialization
// ------------------------------------------------------------------
void initOpenGL() {
    glClearColor(0.05f, 0.05f, 0.1f, 1.0f);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(-1.2f, 1.2f, -1.2f, 1.2f);
    glMatrixMode(GL_MODELVIEW);
}

int main(int argc, char** argv) {
    // Set an initial maxN = 10
    maxN = 10;

    // Compute Collatz for initial maxN
    collatz.computeCollatz(maxN);
    collatzTree = collatz.getCollatzTree();
    computeAxisLimits();

    // Populate stats
    collatzStatsMap.clear();
    for (const auto &pair : collatzTree) {
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
