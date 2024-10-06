# ecitation.py

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, g, flash
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
import sqlite3
from datetime import datetime, timedelta
import requests
from functools import wraps
import threading

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your_secret_key_here')  # Use environment variable for production

# Database configuration
DATABASE = 'citations.db'

# User data with roles (Consider moving this to a database in production)
users = {
    '2405': {'name': 'B. Richardson', 'password': generate_password_hash('defaultpassword'), 'role': 'officer'},
    '1234': {'name': 'Officer Smith', 'password': generate_password_hash('password123'), 'role': 'officer'},
    '5678': {'name': 'Officer Johnson', 'password': generate_password_hash('password456'), 'role': 'officer'},
    '9012': {'name': 'Officer Williams', 'password': generate_password_hash('password789'), 'role': 'officer'},
    'admin': {'name': 'Chief Supervisor', 'password': generate_password_hash('adminpass'), 'role': 'supervisor'}
}

# Add context processor to make datetime globally available in templates
@app.context_processor
def inject_datetime():
    return {'datetime': datetime}

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS citations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number TEXT UNIQUE,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.commit()

ticket_number_lock = threading.Lock()

def get_next_ticket_number():
    with ticket_number_lock:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT MAX(id) FROM citations')
        result = cursor.fetchone()
        last_id = result[0] if result[0] else 0
        next_number = last_id + 1
        return f'CT{next_number:05d}'

def decode_vin(vin):
    vin = vin.strip()
    if not vin:
        return {}
    url = f'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{vin}?format=json'
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        results = data.get('Results', [{}])[0]
        return {
            'make': results.get('Make', ''),
            'model': results.get('Model', ''),
            'year': results.get('ModelYear', ''),
            'vehicle_color': results.get('Color', '')
        }
    except requests.exceptions.RequestException as e:
        print(f"Error decoding VIN: {e}")
        return {}

def decode_pdf417(barcode_data):
    # Placeholder function for barcode decoding
    # Implement actual decoding logic using a library like 'pdf417decoder' or 'pyzbar'
    decoded_info = {
        'firstName': 'John',
        'lastName': 'Doe',
        'dob': '1990-01-01',
        'oln': 'D1234567',
        'streetAddress': '123 Main St',
        'city': 'Anytown',
        'state': 'CO',
        'zipCode': '80000'
    }
    return decoded_info

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def supervisor_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'role' not in session or session['role'] != 'supervisor':
            flash('You do not have permission to access this page.')
            return redirect(url_for('citation_form'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        badge_number = request.form['badgeNumber']
        password = request.form['password']

        user = users.get(badge_number)
        if user and check_password_hash(user['password'], password):
            session['user'] = user['name']
            session['badge_number'] = badge_number
            session['role'] = user['role']
            return redirect(url_for('citation_form'))
        else:
            return render_template('login.html', error='Invalid badge number or password.')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/', methods=['GET', 'POST'])
@login_required
def index():
    return redirect(url_for('citation_form'))

@app.route('/citation_form', methods=['GET', 'POST'])
@login_required
def citation_form():
    if request.method == 'POST':
        data = process_citation_form(request.form)
        db = get_db()
        cursor = db.cursor()
        cursor.execute('INSERT INTO citations (ticket_number, data) VALUES (?, ?)',
                       (data['ticketNumber'], json.dumps(data)))
        db.commit()
        return render_template('citation.html', data=data)
    return render_template('index.html')

def process_citation_form(form_data):
    data = form_data.to_dict()
    data['citationType'] = form_data.getlist('citationType')
    data['ticketNumber'] = get_next_ticket_number()
    data['issueDate'] = data.get('violationDate', datetime.now().strftime('%Y-%m-%d'))
    data['penaltyAssessment'] = 'Penalty Assessment' in data['citationType']
    data['summonsComplaint'] = 'Summons & Complaint' in data['citationType']

    # Process additional offenses
    data['additional_offenses'] = form_data.getlist('additional_offenses')

    # Process defendant information
    mailing_address_same = data.get('mailing_address_same', 'Yes')
    if mailing_address_same == 'No':
        mailing_address = {
            'street': data.get('mailingAddress', ''),
            'city': data.get('mailingCity', ''),
            'state': data.get('mailingState', ''),
            'zip': data.get('mailingZipCode', '')
        }
    else:
        mailing_address = {
            'street': data.get('streetAddress', ''),
            'city': data.get('city', ''),
            'state': data.get('state', ''),
            'zip': data.get('zipCode', '')
        }

    data['defendant'] = {
        'last_name': data.get('lastName', ''),
        'first_name': data.get('firstName', ''),
        'middle_name': data.get('middleName', ''),
        'dob': format_date(data.get('dob', '')),
        'physical_address': {
            'street': data.get('streetAddress', ''),
            'city': data.get('city', ''),
            'state': data.get('state', ''),
            'zip': data.get('zipCode', '')
        },
        'mailing_address': mailing_address,
        'driver_license_number': data.get('oln', ''),
        'driver_details': {
            'class': data.get('licenseClass', ''),
            'state': data.get('dl_state', ''),
            'race': data.get('race', ''),
            'sex': data.get('sex', ''),
            'height_formatted': format_height(data.get('height', '')),
            'weight': data.get('weight', ''),
            'hair': data.get('hairColor', ''),
            'eyes': data.get('eyeColor', '')
        },
        'phone': data.get('phoneNumber', '')
    }

    # Valid CO DL
    data['valid_co_dl'] = data.get('valid_co_dl', 'No')

    # Calculate age
    data['age'] = calculate_age(data['defendant']['dob'])

    # Process vehicle information
    vin_info = decode_vin(data.get('vin', ''))
    data['vehicle_information'] = {
        'registered_owner': {
            'name_and_address': data.get('ownerName', '') + ', ' + data.get('ownerAddress', '')
        },
        'vehicle_license': {
            'state': data.get('plateState', ''),
            'vehicle_year': vin_info.get('year', data.get('year', '')),
            'make': vin_info.get('make', data.get('make', '')),
            'model': vin_info.get('model', data.get('model', '')),
            'color': vin_info.get('vehicle_color', data.get('vehicle_color', '')),
            'vin': data.get('vin', ''),
            'plate_number': data.get('licensePlate', '')
        }
    }

    # Process violations
    violations = []
    total_fine = 0
    summons_required = False
    violation_keys = [key for key in form_data if key.startswith('statute_')]
    violation_indices = set([key.split('_')[1] for key in violation_keys])
    for index in violation_indices:
        statute = form_data.get(f'statute_{index}')
        if statute:
            violation = {
                'statute': statute,
                'violation': form_data.get(f'charge_{index}', ''),
                'code': form_data.get(f'violationCode_{index}', ''),
                'points': form_data.get(f'points_{index}', ''),
                'fine': form_data.get(f'fineAmount_{index}', ''),
                'mph_over_limit': form_data.get(f'mphOverLimit_{index}', ''),
                'summons': form_data.get(f'summons_{index}', '') == 'on'
            }
            violations.append(violation)
            if violation['fine'].isdigit():
                total_fine += int(violation['fine'])
            if violation['summons']:
                summons_required = True

    data['violations'] = violations
    data['total_fine'] = total_fine
    data['total_charges'] = len(violations)
    data['summonsRequired'] = summons_required

    # Adjust penaltyAssessment if any charge requires summons
    if summons_required:
        data['penaltyAssessment'] = False
        data['citationType'] = ['Summons & Complaint']

    # Court information
    data['court_information'] = {
        'court_location': 'Morrison Municipal Court, 321 Colorado Highway 8, Morrison, CO 80465',
        'court_name': 'Morrison Municipal Court'
    }

    # Set court date and time
    court_date = datetime.now() + timedelta(days=30)
    data['courtDate'] = court_date.strftime('%Y-%m-%d')
    last_name = data['defendant']['last_name'].upper()
    if last_name and 'A' <= last_name[0] <= 'E':
        data['courtTime'] = '8:30 AM'
    elif last_name and 'F' <= last_name[0] <= 'Q':
        data['courtTime'] = '9:30 AM'
    else:
        data['courtTime'] = '10:30 AM'

    # Officer information
    data['officerName'] = session['user']
    data['badgeNumber'] = session['badge_number']

    # Additional fields
    data['time_of_violation_formatted'] = format_time(data.get('timeOfStop', ''))
    data['approximate_location'] = data.get('location', '')
    data['us_citizen'] = data.get('us_citizen', 'No')
    data['direction_of_travel'] = data.get('direction_of_travel', '')
    data['photoData'] = data.get('photoData', '')

    # Penalty Assessment details
    data['penalty_assessment'] = {
        'payment_due_by': (datetime.now() + timedelta(days=20)).strftime('%Y-%m-%d'),
        'automatic_point_reduction_eligible': False
    }

    return data

def format_date(date_str):
    if date_str:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d/%y')
        except ValueError:
            return ''
    return ''

def calculate_age(dob_str):
    if dob_str:
        try:
            dob = datetime.strptime(dob_str, '%m/%d/%y')
            today = datetime.now()
            return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except ValueError:
            return ''
    return ''

def format_height(height_str):
    try:
        height = int(height_str)
        feet = height // 12
        inches = height % 12
        return f"{feet}'{inches:02d}\""
    except (ValueError, TypeError):
        return ''

def format_time(time_str):
    if time_str:
        try:
            time_obj = datetime.strptime(time_str, '%H:%M')
            return time_obj.strftime('%I:%M %p').lstrip('0')
        except ValueError:
            return ''
    return ''

@app.template_filter('format_date')
def format_date_filter(date):
    if isinstance(date, str):
        try:
            date = datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return date
    return date.strftime('%m/%d/%Y')

@app.template_filter('format_time')
def format_time_filter(time):
    if isinstance(time, str):
        try:
            time = datetime.strptime(time, '%H:%M')
        except ValueError:
            return time
    return time.strftime('%I:%M %p').lstrip('0')

@app.route('/citations')
@login_required
def view_citations():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT ticket_number, data FROM citations')
    all_citations = cursor.fetchall()
    citations = [
        (row['ticket_number'], json.loads(row['data']))
        for row in all_citations
        if json.loads(row['data'])['badgeNumber'] == session['badge_number']
    ]
    current_year = datetime.now().year
    return render_template('citations.html', citations=citations, current_year=current_year)

@app.route('/citations/<ticket_number>', methods=['GET'])
@login_required
def view_citation(ticket_number):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT data FROM citations WHERE ticket_number = ?', (ticket_number,))
    row = cursor.fetchone()
    if row:
        data = json.loads(row['data'])
        if data['badgeNumber'] == session['badge_number'] or session['role'] == 'supervisor':
            return render_template('citation.html', data=data)
        return "You do not have permission to view this citation.", 403
    return "Citation not found", 404

@app.route('/citations/<ticket_number>/modify', methods=['GET', 'POST'])
@login_required
def modify_citation(ticket_number):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT data FROM citations WHERE ticket_number = ?', (ticket_number,))
    row = cursor.fetchone()
    if row:
        data = json.loads(row['data'])
        if data['badgeNumber'] != session['badge_number'] and session['role'] != 'supervisor':
            return "You do not have permission to modify this citation.", 403
        if request.method == 'POST':
            data['modificationReason'] = request.form.get('reason', '')
            data['isVoided'] = request.form.get('void', '') == 'on'
            data['isModified'] = True
            data['lastModifiedDate'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            data['modifiedBy'] = session['user']
            cursor.execute('UPDATE citations SET data = ? WHERE ticket_number = ?',
                           (json.dumps(data), ticket_number))
            db.commit()
            return redirect(url_for('view_citations'))
        return render_template('modify_citation.html', data=data)
    return "Citation not found", 404

@app.route('/citations/<ticket_number>/add_notes', methods=['GET', 'POST'])
@login_required
def add_notes(ticket_number):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT data FROM citations WHERE ticket_number = ?', (ticket_number,))
    row = cursor.fetchone()
    if row:
        data = json.loads(row['data'])
        if data['badgeNumber'] != session['badge_number'] and session['role'] != 'supervisor':
            return "You do not have permission to add notes to this citation.", 403
        if request.method == 'POST':
            ticket_notes = {
                'attitude': request.form.get('attitude', ''),
                'road': request.form.get('road', ''),
                'sky': request.form.get('sky', ''),
                'radar_laser': request.form.get('radar_laser', ''),
                'officer_unit_number': request.form.get('officer_unit_number', ''),
                'officer_laser_number': request.form.get('officer_laser_number', ''),
                'sn_fork_25': request.form.get('sn_fork_25', ''),
                'sn_fork_50': request.form.get('sn_fork_50', ''),
                'sn_fork_75': request.form.get('sn_fork_75', ''),
                'officer_notes': request.form.get('officer_notes', '')
            }
            data['ticket_notes'] = ticket_notes
            cursor.execute('UPDATE citations SET data = ? WHERE ticket_number = ?',
                           (json.dumps(data), ticket_number))
            db.commit()
            return redirect(url_for('view_citation', ticket_number=ticket_number))
        return render_template('add_notes.html', data=data)
    return "Citation not found", 404

@app.route('/citations/all')
@supervisor_required
def view_all_citations():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT ticket_number, data FROM citations')
    citations = [(row['ticket_number'], json.loads(row['data'])) for row in cursor.fetchall()]
    current_year = datetime.now().year

    # Get list of officers
    officers = sorted(set(citation['officerName'] for _, citation in citations))

    return render_template('all_citations.html', citations=citations, officers=officers, current_year=current_year)

@app.route('/officer/<officer_name>')
@supervisor_required
def view_officer_citations(officer_name):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT ticket_number, data FROM citations')
    all_citations = cursor.fetchall()
    citations = [
        (row['ticket_number'], json.loads(row['data']))
        for row in all_citations
        if json.loads(row['data'])['officerName'] == officer_name
    ]
    current_year = datetime.now().year
    return render_template('officer_citations.html', citations=citations, officer_name=officer_name, current_year=current_year)

@app.route('/search', methods=['GET', 'POST'])
@login_required
def search():
    citations = []
    query = ''
    if request.method == 'POST':
        query = request.form['query'].strip().lower()
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT ticket_number, data FROM citations')
        all_citations = cursor.fetchall()
        for row in all_citations:
            data = json.loads(row['data'])
            if matches_query(data, query):
                citations.append((row['ticket_number'], data))
    return render_template('search.html', citations=citations, query=query)

def matches_query(data, query):
    fields_to_search = [
        data.get('ticketNumber', ''),
        data.get('issueDate', ''),
        data.get('timeOfStop', ''),
        data.get('approximate_location', ''),
        data.get('officerName', ''),
        data.get('vehicle_information', {}).get('vehicle_license', {}).get('plate_number', ''),
        data.get('vehicle_information', {}).get('vehicle_license', {}).get('vin', ''),
        data.get('defendant', {}).get('driver_license_number', ''),
        data.get('defendant', {}).get('first_name', '') + ' ' + data.get('defendant', {}).get('last_name', '')
    ]
    for field in fields_to_search:
        if query in field.lower():
            return True
    return False

@app.route('/analytics')
@supervisor_required
def analytics_dashboard():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT data FROM citations')
    rows = cursor.fetchall()
    if not rows:
        return render_template('analytics.html', no_data=True)
    citations = [json.loads(row['data']) for row in rows]

    officer_counts = {}
    infraction_counts = {}
    time_counts = {}
    location_counts = {}

    for citation in citations:
        officer = citation.get('officerName', 'Unknown')
        officer_counts[officer] = officer_counts.get(officer, 0) + 1

        for violation in citation.get('violations', []):
            charge = violation.get('violation', 'Unknown')
            infraction_counts[charge] = infraction_counts.get(charge, 0) + 1

        time_of_stop = citation.get('timeOfStop', '')
        if time_of_stop:
            try:
                hour = int(time_of_stop.split(':')[0])
                time_counts[hour] = time_counts.get(hour, 0) + 1
            except ValueError:
                continue

        location = citation.get('approximate_location', 'Unknown')
        location_counts[location] = location_counts.get(location, 0) + 1

    officer_data = {
        'labels': list(officer_counts.keys()),
        'data': list(officer_counts.values())
    }

    infraction_data = {
        'labels': list(infraction_counts.keys()),
        'data': list(infraction_counts.values())
    }

    time_data = {
        'labels': [f"{h:02d}:00" for h in sorted(time_counts.keys())],
        'data': [time_counts[h] for h in sorted(time_counts.keys())]
    }

    location_data = {
        'labels': list(location_counts.keys()),
        'data': list(location_counts.values())
    }

    return render_template('analytics.html',
                           officer_data=officer_data,
                           infraction_data=infraction_data,
                           time_data=time_data,
                           location_data=location_data)

@app.route('/decode_vin/<vin>')
@login_required
def decode_vin_endpoint(vin):
    vehicle_info = decode_vin(vin)
    if vehicle_info:
        return jsonify({'success': True, **vehicle_info})
    else:
        return jsonify({'success': False}), 400

@app.route('/decode_pdf417', methods=['POST'])
@login_required
def decode_pdf417_endpoint():
    barcode_data = request.form.get('barcodeData', '')
    decoded_info = decode_pdf417(barcode_data)
    if decoded_info:
        return jsonify({'success': True, **decoded_info})
    else:
        return jsonify({'success': False}), 400

@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', error_message="Page not found (404)"), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('error.html', error_message="Internal server error (500)"), 500

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)