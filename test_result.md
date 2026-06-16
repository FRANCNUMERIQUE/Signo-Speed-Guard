#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Two fixes requested:
  1. Build EAS échoue car google-services.json est ignoré (était dans .gitignore). Le fichier doit être committé pour que FCM fonctionne.
  2. Cliquer sur un bouton de signalement (radar, police, accident, obstacle, travaux) ne dépose AUCUN marqueur visible sur la carte. Il faut que le marqueur apparaisse immédiatement sur la carte à la position de l'utilisateur.

backend:
  - task: "POST /api/danger-zones — create new danger zone"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoint pre-existing. Verify it returns an object with id, lat, lon, type, label, confirmations, created_at when called with X-Device-Id header."
  - task: "GET /api/danger-zones — list zones around point"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoint pre-existing. Verify it returns an array of zones within radius_km, each with label populated and zone created in previous POST is included."

frontend:
  - task: "Danger zone markers visible on home map after signaling"
    implemented: true
    working: "NA"
    file: "frontend/src/components/MapWrapper.native.tsx, frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added Marker rendering in MapWrapper.native.tsx with custom colored icons per type (police=blue shield, speed_camera=red camera, accident=orange warning, hazard=orange alert, construction=yellow construct). Updated reportDanger() to do optimistic UI update (instantly add marker to zones state) then POST, then sync from server. Pass zones prop from index.tsx into MapWrapper."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 3

test_plan:
  current_focus:
    - "POST /api/danger-zones — create new danger zone"
    - "GET /api/danger-zones — list zones around point"
    - "Danger zone markers visible on home map after signaling"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Iteration 3 — fixes:
      1) Removed google-services.json from frontend/.gitignore (commented out) so EAS can bundle it.
      2) Updated MapWrapper.native.tsx to render <Marker> for each danger zone with custom colored Ionicons.
      3) Updated reportDanger() in app/(tabs)/index.tsx to do an optimistic update: marker appears INSTANTLY upon click without waiting for the POST roundtrip. After POST succeeds, replace the temporary marker with the server one and refresh.
      
      Backend tests needed:
      - POST /api/danger-zones with body {lat: 48.8566, lon: 2.3522, type: "speed_camera"} and header X-Device-Id: test-device-zone — must return 200 with id, lat, lon, type, label="Radar", confirmations=1.
      - GET /api/danger-zones?lat=48.8566&lon=2.3522&radius_km=5 — must return an array including the zone just created.
      - Try all 5 types: police, speed_camera, accident, hazard, construction. Each must persist with correct French label.
      
      Frontend tests: backend only for now (map markers will be visually verified by user on device — react-native-maps doesn't render on web preview).
