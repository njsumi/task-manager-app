import React, { useState, useEffect } from 'react';
//import { Plus, Edit, Trash2, Filter, X, Loader2 } from 'lucide-react';

import './App.css';

const API_URL = 'http://127.0.0.1:5000';

const statusColors = (status) => {
  switch (status) {
    case 'not started':
      return 'bg-slate-200 text-slate-600';
    case 'in progress':
      return 'bg-amber-200 text-yellow-700';
    case 'submitted':
      return 'bg-lime-200 text-lime-700';
    default:
      return 'bg-slate-200 text-slate-600';
  }
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all');
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCourse, setNewTaskCourse] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDateAssigned, setNewTaskDateAssigned] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const [createForm, setCreateForm] = useState(false);
  const [editForm, setEditForm] = useState(false);
  const [viewReport, setViewReport] = useState(false)

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [selectedCourse]);


  const fetchTasks = async () => {
    setError(null);
    const params = new URLSearchParams();

    if (filter && filter !== 'all') params.append('filter', filter);
    if (selectedCourse) params.append('course', selectedCourse);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const url = `${API_URL}/tasks${params.toString() ? '?' + params.toString() : ''}`;


    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }
      const data = await response.json();
      setTasks(data);
      fetchCourses();
    } catch (e) {
      console.error("Fetch error:", e);
      setError(e.message);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks`);
      const data = await response.json();
      const uniqueCourses = Array.from(new Set(data.map(task => task.course)));
      setCourses(uniqueCourses);
    } catch (e) {
      console.error("Fetch all courses error:", e);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) {
      setError("Task Name is required.");
      return;
    }

    const taskData = {
      name: newTaskName,
      course: newTaskCourse,
      description: newTaskDesc,
      status: 'not started',
      due_date: newTaskDueDate,
      date_assigned: newTaskDateAssigned,
    };

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      setNewTaskName('');
      setNewTaskCourse('');
      setNewTaskDesc('');
      setNewTaskDueDate('');
      setError(null);
      setCreateForm(false);
      await fetchTasks();
    } catch (e) {
      console.error("Failed to create task:", e);
      setError(e.message);
    }
  };

  const handleCancelCreate = () => {
    setNewTaskName('');
    setNewTaskCourse('');
    setNewTaskDesc('');
    setNewTaskDueDate('');
    setError(null);
    setCreateForm(false);
  };

  const handleDeleteTask = async(name, course) => {
    const response = await fetch(`${API_URL}/tasks/${encodeURIComponent(name)}/${encodeURIComponent(course)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete task');
    }

    await fetchTasks();
  };

  const closeEditForm = () => {
    setEditForm(null);
    setError(null);
  };
  
  const handleEditTask = async(e) => {
    e.preventDefault();

    const name = editForm.name;
    const course = editForm.course;
    const new_status = e.target.status.value;

    const updatedData = {
      name: e.target.name.value,
      course: e.target.course.value,
      description: e.target.description.value,
      status: new_status
    };

    if (e.target.date_assigned.value) updatedData.date_assigned = e.target.date_assigned.value;
    if (e.target.due_date.value) updatedData.due_date = e.target.due_date.value;

    if (new_status === "submitted") {
      const today = new Date().toISOString().split("T")[0];
      updatedData.date_submitted = today;
    }

    const response = await fetch(`${API_URL}/tasks/${encodeURIComponent(name)}/${encodeURIComponent(course)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update task');
    }

    closeEditForm();
    await fetchTasks();
  };

  const submittedTasks = tasks.length > 0 ? (tasks.filter(t => t.status === 'submitted').length / tasks.length * 100).toFixed(1) : 0;
  const inProgressTasks = tasks.length > 0 ? (tasks.filter(t => t.status === 'in progress').length / tasks.length * 100).toFixed(1) : 0;
  const notStartedTasks = tasks.length > 0 ? (tasks.filter(t => t.status === 'not started').length / tasks.length * 100).toFixed(1) : 0;
  const overdueTasks = tasks.length > 0 ? (tasks.filter(t => {
    const due = new Date(t.due_date);
    return due < new Date() && t.status !== 'submitted';
  }).length / tasks.length * 100).toFixed(1) : 0; 

  const submittedTasksWithDates = tasks.filter(
    t => t.status === 'submitted' && t.date_assigned && t.date_submitted
  );

  let avgCompletionTime = 0;
  if (submittedTasksWithDates.length > 0) {
    const totalDays = submittedTasksWithDates.reduce((sum, t) => {
      const created = new Date(t.date_assigned);
      const submitted = new Date(t.date_submitted);
      const diffDays = (submitted - created) / (1000 * 60 * 60 * 24);
      return sum + diffDays;
    }, 0);
    avgCompletionTime = totalDays / submittedTasksWithDates.length;
  }


  return (
    <div>
      <div>

        <h1 className="text-2xl font-semibold mt-10 mb-10 text-slate-700">Task Manager</h1>

        <div className="mx-auto w-full max-w-7xl">

          <div className="flex justify-between items-center gap-4 bg-gray-100 p-4 rounded-xl shadow-sm">
            
            <div className="flex items-center gap-3">
              {/* create task button */}
              {!createForm ? (
                <button onClick={() => setCreateForm(true)}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-100 text-slate-600 hover:bg-indigo-200 transition"
                >
                  Create New Task
                </button>
              ) : (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md relative">
                    <h2 className="text-xl font-semibold mb-4 text-slate-700">Add New Task</h2>

                    <button type="button" onClick={handleCancelCreate}
                      className="absolute top-3 right-4 text-gray-500 hover:text-gray-800"
                    >
                      ✕
                    </button>

                    <form onSubmit={handleCreateTask} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Name</label>
                        <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
                          className="w-full border rounded-md px-3 py-2"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Course</label>
                        <input value={newTaskCourse} onChange={(e) => setNewTaskCourse(e.target.value)}
                          className="w-full border rounded-md px-3 py-2"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Description</label>
                        <textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} rows="3"
                          className="w-full border rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Date Assigned</label>
                        <input type="date" value={newTaskDateAssigned} onChange={(e) => setNewTaskDateAssigned(e.target.value)}
                          className="w-full border rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Due Date</label>
                        <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)}
                          className="w-full border rounded-md px-3 py-2"
                        />
                      </div>
                      <div className="flex justify-end space-x-2 pt-2 text-slate-700">
                        <button type="button" onClick={handleCancelCreate}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button type="submit"
                          className="px-4 py-2 bg-green-200 text-green-800 rounded-full font-medium hover:bg-green-300"
                        >
                          Create Task
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* View Report Button */}

              <div>
                {!viewReport ? (
                  <button onClick={() => setViewReport(true)}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-100 text-slate-600 hover:bg-indigo-200 transition"
                  >
                    View Report
                  </button>
                ) : (
                  <button onClick={() => setViewReport(false)}/>
                )}

              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3">
              <button onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-full mr-2 text-sm font-medium ${filter === 'all' ? 'bg-indigo-200 text-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                All
              </button>
              <button onClick={() => setFilter("current")}
                className={`px-3 py-1 rounded-full mr-2 text-sm font-medium ${filter === 'current' ? 'bg-indigo-200 text-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Current
              </button>
              <button onClick={() => setFilter("overdue")}
                className={`px-3 py-1 rounded-full mr-2 text-sm font-medium ${filter === 'overdue' ? 'bg-indigo-200 text-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Overdue
              </button>

              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-slate-800">Course</label>
                <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                  <option value=""></option>
                  {courses.map(course => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="block text-sm text-slate-800 font-medium">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <label className="block text-sm text-slate-800 font-medium">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <button onClick={fetchTasks} 
                  className="px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-slate-600 hover:bg-indigo-200 transition"
                >
                  Apply
                </button>
              </div>
              

            </div>
          </div>
          

          {/* --- Task List --- */}
          <div className="mt-4 overflow-hidden rounded-xl">
              <table className="w-full">
                <colgroup>
                  <col style={{width: '14%'}}/>
                  <col style={{width: '10%'}}/>
                  <col style={{width: '12%'}}/>
                  <col style={{width: '18%'}}/>
                  <col style={{width: '10%'}}/>
                  <col style={{width: '10%'}}/>
                  <col style={{width: '10%'}}/>
                  <col style={{width: '16%'}}/>
                </colgroup>
                <thead className="bg-indigo-100">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Task Name</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Course</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Status</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Description</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Date Assigned</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Due Date</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Submitted On</th>
                    <th className="px-4 py-3 border-b border-slate-400 text-slate-800 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="px-4 py-3 bg-gray-100 p-4 rounded-xl shadow-sm text-slate-600 font-normal">
                  {tasks.map(task => (
                    <tr key={`${task.name}-${task.course}`}>
                      <td>{task.name}</td>
                      <td>{task.course}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-4 py-1 rounded-full text-sm font-medium ${statusColors(task.status)}`}>{task.status}</span>
                      </td>
                      <td>{task.description}</td>
                      <td>{new Date(task.date_assigned).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
                      <td>{new Date(task.due_date).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
                      <td>{task.date_submitted ? new Date(task.date_submitted).toLocaleDateString() : "-"}</td>
                      <td className="space-x-2">
                        <button 
                          onClick={() => setEditForm(task)}
                          className="px-4 py-1 rounded-full text-sm font-medium bg-blue-200 text-blue-800 hover:bg-blue-300 transition"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteTask(task.name, task.course)}
                          className="px-4 py-1 rounded-full text-sm font-medium bg-rose-200 text-rose-800 hover:bg-rose-300 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </div>

        <div>
          {editForm && (
            <div>
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md relative">
                  <h2 className="text-xl font-semibold mb-4 text-slate-700">Add New Task</h2>

                  <button type="button" onClick={closeEditForm}
                    className="absolute top-3 right-4 text-gray-500 hover:text-gray-800"
                  >
                    ✕
                  </button>

                  <form onSubmit={handleEditTask} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Name</label>
                      <input name="name" type="text" defaultValue={editForm.name}
                        className="w-full border rounded-md px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Course</label>
                      <input name="course" defaultValue={editForm.course}
                        className="w-full border rounded-md px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Status</label>
                      <select name="status" defaultValue={editForm.status}>
                        <option value="not started">Not Started</option>
                        <option value="in progress">In Progress</option>
                        <option value="submitted">Submitted</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Description</label>
                      <textarea name="description" defaultValue={editForm.description} rows="3"
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Date Assigned</label>
                      <input type="date" name="date_assigned" defaultValue={editForm.date_assigned}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Due Date</label>
                      <input type="date" name="due_date" defaultValue={editForm.due_date}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button type="button" onClick={closeEditForm}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button type="submit"
                        className="px-4 py-2 bg-green-200 text-green-800 rounded-full font-medium hover:bg-green-300"
                      >
                        Update Task
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div> 
          )}
        </div>  



        {viewReport && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md relative">
              <h2 className="text-xl font-semibold mb-4 text-slate-700">Report</h2>
              <button 
                onClick={() => setViewReport(false)} 
                className="absolute top-3 right-4 text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
              <ul className="space-y-2 text-slate-600">
                <li><b>Total tasks:</b> {tasks.length}</li>
                <li><b>Not started:</b> {notStartedTasks}%</li>
                <li><b>In progress:</b> {inProgressTasks}%</li>
                <li><b>Submitted:</b> {submittedTasks}%</li>
                <li><b>Overdue:</b> {overdueTasks}%</li>

                <li>
                  <b>Average completion time:</b>{" "}
                  {submittedTasksWithDates.length > 0
                    ? `${avgCompletionTime.toFixed(1)} days`
                    : "N/A"}
                </li>
              </ul>
            </div>
          </div>
        )} 
      </div>
    </div>
  );
}

export default App;
