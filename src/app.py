"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
from pathlib import Path
import re
from datetime import time

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


# Helper function to determine activity category
def get_activity_category(activity_name: str) -> str:
    """Categorize activities by type for color coding"""
    sports = ["Soccer Team", "Basketball Team", "Gym Class"]
    arts = ["Drama Club", "Art Club"]
    academic = ["Programming Class", "Math Club", "Chess Club", "Debate Team"]
    
    if activity_name in sports:
        return "sports"
    elif activity_name in arts:
        return "arts"
    elif activity_name in academic:
        return "academic"
    return "other"


# Helper function to parse schedule strings into structured data
def parse_schedule(schedule_str: str) -> list:
    """
    Parse schedule string into list of time slots.
    Returns: [{"day": "Monday", "start_time": "14:00", "end_time": "15:00"}, ...]
    """
    days_map = {
        "monday": "Monday", "mondays": "Monday",
        "tuesday": "Tuesday", "tuesdays": "Tuesday",
        "wednesday": "Wednesday", "wednesdays": "Wednesday",
        "thursday": "Thursday", "thursdays": "Thursday",
        "friday": "Friday", "fridays": "Friday",
        "saturday": "Saturday", "saturdays": "Saturday"
    }
    
    time_slots = []
    
    # Extract days
    days = []
    schedule_lower = schedule_str.lower()
    
    # Check for multiple days with "and"
    for day_key, day_value in days_map.items():
        if day_key in schedule_lower:
            if day_value not in days:
                days.append(day_value)
    
    # Extract time range (e.g., "3:30 PM - 5:00 PM")
    time_pattern = r'(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)'
    time_match = re.search(time_pattern, schedule_str, re.IGNORECASE)
    
    if time_match:
        start_hour = int(time_match.group(1))
        start_min = time_match.group(2)
        start_period = time_match.group(3).upper()
        end_hour = int(time_match.group(4))
        end_min = time_match.group(5)
        end_period = time_match.group(6).upper()
        
        # Convert to 24-hour format
        if start_period == "PM" and start_hour != 12:
            start_hour += 12
        elif start_period == "AM" and start_hour == 12:
            start_hour = 0
            
        if end_period == "PM" and end_hour != 12:
            end_hour += 12
        elif end_period == "AM" and end_hour == 12:
            end_hour = 0
        
        start_time = f"{start_hour:02d}:{start_min}"
        end_time = f"{end_hour:02d}:{end_min}"
        
        # Create time slot for each day
        for day in days:
            time_slots.append({
                "day": day,
                "start_time": start_time,
                "end_time": end_time
            })
    
    return time_slots


# Helper function to check if two time slots conflict
def times_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two time ranges overlap"""
    # Convert time strings to comparable format
    s1_h, s1_m = map(int, start1.split(':'))
    e1_h, e1_m = map(int, end1.split(':'))
    s2_h, s2_m = map(int, start2.split(':'))
    e2_h, e2_m = map(int, end2.split(':'))
    
    start1_mins = s1_h * 60 + s1_m
    end1_mins = e1_h * 60 + e1_m
    start2_mins = s2_h * 60 + s2_m
    end2_mins = e2_h * 60 + e2_m
    
    # Check for overlap
    return not (end1_mins <= start2_mins or end2_mins <= start1_mins)


# Helper function to detect conflicts for a student
def detect_conflicts(email: str, new_activity_name: str) -> list:
    """
    Detect scheduling conflicts for a student trying to sign up for a new activity.
    Returns list of conflicting activity names.
    """
    conflicts = []
    
    # Get time slots for the new activity
    new_slots = parse_schedule(activities[new_activity_name]["schedule"])
    
    # Check all activities the student is enrolled in
    for activity_name, activity_data in activities.items():
        if email in activity_data["participants"] and activity_name != new_activity_name:
            existing_slots = parse_schedule(activity_data["schedule"])
            
            # Check for overlaps
            for new_slot in new_slots:
                for existing_slot in existing_slots:
                    if new_slot["day"] == existing_slot["day"]:
                        if times_overlap(
                            new_slot["start_time"], new_slot["end_time"],
                            existing_slot["start_time"], existing_slot["end_time"]
                        ):
                            if activity_name not in conflicts:
                                conflicts.append(activity_name)
    
    return conflicts


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.get("/calendar")
def get_calendar():
    """
    Get activities organized by day and time for calendar view.
    Returns a structured calendar with activities grouped by time slots.
    """
    calendar_data = {
        "Monday": [],
        "Tuesday": [],
        "Wednesday": [],
        "Thursday": [],
        "Friday": [],
        "Saturday": [],
        "Sunday": []
    }
    
    # Process each activity
    for activity_name, activity_data in activities.items():
        time_slots = parse_schedule(activity_data["schedule"])
        category = get_activity_category(activity_name)
        
        for slot in time_slots:
            calendar_data[slot["day"]].append({
                "name": activity_name,
                "description": activity_data["description"],
                "start_time": slot["start_time"],
                "end_time": slot["end_time"],
                "category": category,
                "participants_count": len(activity_data["participants"]),
                "max_participants": activity_data["max_participants"],
                "spots_left": activity_data["max_participants"] - len(activity_data["participants"])
            })
    
    # Sort activities by start time for each day
    for day in calendar_data:
        calendar_data[day].sort(key=lambda x: x["start_time"])
    
    return calendar_data


@app.get("/student/{email}/schedule")
def get_student_schedule(email: str):
    """
    Get a student's personal schedule showing all activities they're enrolled in.
    """
    student_activities = []
    
    for activity_name, activity_data in activities.items():
        if email in activity_data["participants"]:
            time_slots = parse_schedule(activity_data["schedule"])
            category = get_activity_category(activity_name)
            
            for slot in time_slots:
                student_activities.append({
                    "name": activity_name,
                    "day": slot["day"],
                    "start_time": slot["start_time"],
                    "end_time": slot["end_time"],
                    "category": category
                })
    
    # Sort by day and time
    day_order = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, 
                 "Friday": 4, "Saturday": 5, "Sunday": 6}
    student_activities.sort(key=lambda x: (day_order.get(x["day"], 7), x["start_time"]))
    
    return {
        "email": email,
        "activities": student_activities,
        "total_activities": len(set(a["name"] for a in student_activities))
    }


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str):
    """Sign up a student for an activity with conflict detection"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )
    
    # Check for scheduling conflicts
    conflicts = detect_conflicts(email, activity_name)
    if conflicts:
        conflict_list = ", ".join(conflicts)
        raise HTTPException(
            status_code=409,
            detail=f"Schedule conflict with: {conflict_list}"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str):
    """Unregister a student from an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
