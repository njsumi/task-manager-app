import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import select, insert, update, delete
from flask_cors import CORS
import datetime
import re

app = Flask(__name__)

CORS(app) 
directory = os.path.abspath(os.path.dirname(__file__))

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(directory, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Task(db.Model):

    __table_args__ = (
        db.Index('idx_course', 'course'),
        db.Index('idx_due_date', 'due_date'),
        db.Index('idx_status', 'status'),
        db.Index('idx_date_assigned', 'date_assigned'),
    )

    name = db.Column(db.String(200), primary_key=True, nullable=False)
    course = db.Column(db.String(100), primary_key=True, nullable=False)
    description = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='not started') #'not started', 'in progress', 'submitted'
    date_assigned = db.Column(db.Date, nullable=False, default=datetime.date.today)
    due_date = db.Column(db.Date, nullable=True)
    date_submitted = db.Column(db.Date, nullable=True)
    
    def to_dict(self):
        return {
            'name': self.name,
            'course': self.course,
            'description': self.description,
            'status': self.status,
            'date_assigned': self.date_assigned.isoformat(),
            'due_date': self.due_date.isoformat(),
            'date_submitted': self.date_submitted.isoformat() if self.date_submitted else None
        }

def clean_input(text):
    if not isinstance(text, str):
        return str(text)
    cleaned = re.sub(r'[^a-zA-Z0-9\s.,!?:;\'"()_\-\[\]]', '', text)
    return cleaned.strip()
    
@app.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()

    if not data or not data.get('name') or not data.get('course'):
        return jsonify({'error': 'Name and course are required'}), 400
    
    try:
        name = clean_input(data['name'])
        course = clean_input(data['course'])
        description = clean_input(data.get('description', ''))

        print(f"Adding task: {repr(name)}, {repr(course)}")
        
        existing_task = db.session.get(Task, (name, course))
        if existing_task:
            return jsonify({'error': 'Task with this name and course already exists'}), 409
        
        date_assigned = None
        if data.get('date_assigned'):
            date_assigned = datetime.datetime.strptime(data['date_assigned'], '%Y-%m-%d').date()
        else:
            date_assigned = datetime.date.today()

        due_date = None
        if data.get('due_date'):
            due_date = datetime.datetime.strptime(data['due_date'], '%Y-%m-%d').date()

        new_task = Task(
            name=name,
            course=course,
            description=description,
            status=data.get('status', 'not started'),
            date_assigned=date_assigned,
            due_date=due_date,
            date_submitted=None
        )


        db.session.add(new_task)
        db.session.commit()
        return jsonify(new_task.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Could not create task: {str(e)}'}), 500

@app.route('/tasks', methods=['GET'])
def get_tasks():
    filter = request.args.get('filter')
    course = request.args.get('course')

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date:
        start_date = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
    if end_date:
        end_date = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()

    try:
        query = select(Task)
        if course:
            query = query.where(Task.course == course)
        if filter == 'current':
            query = query.where(Task.status != 'submitted')
        elif filter == 'overdue':
            today = datetime.date.today()
            query = query.where(Task.due_date < today, Task.status != 'submitted')

        if start_date:
            query = query.where(Task.date_assigned >= start_date)
        if end_date:
            query = query.where(Task.date_assigned <= end_date)

        tasks = db.session.execute(query).scalars().all()
        tasks = sorted(tasks, key=lambda t: (t.due_date is None, t.due_date))

        
        return jsonify([task.to_dict() for task in tasks]), 200
    except Exception as e:
        return jsonify({'error': f'Could not retrieve tasks: {str(e)}'}), 500

@app.route('/tasks/<string:name>/<string:course>', methods=['GET'])
def get_task(name, course):
    try:
        task = db.session.get(Task, (name, course))
        if task:
            return jsonify(task.to_dict()), 200
        else:
            return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Could not retrieve task: {str(e)}'}), 500
    

@app.route('/tasks/<string:name>/<string:course>', methods=['DELETE'])
def delete_task(name, course):
    try:
        task = db.session.get(Task, (name, course))
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        db.session.delete(task)
        db.session.commit()
        return jsonify({'message': 'Task deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Could not delete task: {str(e)}'}), 500

@app.route('/tasks/<string:name>/<string:course>', methods=['PUT'])
def edit_task(name, course):
    try:
        task = db.session.get(Task, (name, course))
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No update data provided'}), 400
        
        new_name = clean_input(data['name'])
        new_course = clean_input(data['course'])
        
        if name != new_name or course != new_course:
            # if trying to change primary key, check for duplicates
            existing_task = db.session.get(Task, (data['name'], data['course']))
            if existing_task:
                return jsonify({'error': 'Task with this name and course already exists'}), 409
            
            task.name = new_name
            task.course = new_course
        
        if 'description' in data:
            task.description = clean_input(data['description'])

        if 'status' in data:
            task.status = data['status']

        if 'date_assigned' in data:
            if data['date_assigned']:
                task.date_assigned = datetime.datetime.strptime(data['date_assigned'], '%Y-%m-%d').date()
            else:
                task.date_assigned = None


        if 'due_date' in data:
            if data['due_date']:
                task.due_date = datetime.datetime.strptime(data['due_date'], '%Y-%m-%d').date()
            else:
                task.due_date = None


        if 'date_submitted' in data:
            if data['date_submitted']:
                try:
                    task.date_submitted = datetime.datetime.strptime(data['date_submitted'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid date_submitted format. Use YYYY-MM-DD.'}), 400
            else:
                task.date_submitted = None

        db.session.commit()
        return jsonify(task.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Could not update task: {str(e)}'}), 500


if __name__ == '__main__':
    #if not os.path.exists(os.path.join(directory, 'database.db')):
    with app.app_context():
        db.create_all()
    
    # app.run(debug=True)
    app.run(host="0.0.0.0", port=5000, debug=True)


