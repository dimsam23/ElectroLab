from flask import Blueprint, request, jsonify
from datetime import datetime
from electrolab import db
from electrolab.models import Project, CalculationHistory

projects_bp = Blueprint('projects_api', __name__, url_prefix='/api/projects')

# --- CALCULATION HISTORY API ---
@projects_bp.route('/history-calc', methods=['GET', 'POST', 'DELETE'])
def handle_calc_history():
    if request.method == 'POST':
        data = request.json
        new_calc = CalculationHistory(
            operation=data.get('operation'),
            input_data=data.get('input'),
            result=data.get('result')
        )
        db.session.add(new_calc)
        db.session.commit()
        return jsonify(new_calc.to_dict()), 201
    
    if request.method == 'DELETE':
        CalculationHistory.query.delete()
        db.session.commit()
        return jsonify({'message': 'All deleted'}), 200

    limit = request.args.get('limit', 10, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    history = CalculationHistory.query.order_by(CalculationHistory.created_at.desc())\
                .limit(limit).offset(offset).all()
    
    total = CalculationHistory.query.count()
    
    return jsonify({
        'history': [h.to_dict() for h in history],
        'total': total
    }), 200

@projects_bp.route('/history-calc/<int:calc_id>', methods=['DELETE'])
def delete_calc_history(calc_id):
    entry = CalculationHistory.query.get(calc_id)
    if not entry:
        return jsonify({'error': 'Entry not found'}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200

# --- PROJECTS API ---

@projects_bp.route('', methods=['GET'])
def list_projects():
    projects = Project.query.all()
    return jsonify({p.id: p.to_dict() for p in projects}), 200

@projects_bp.route('/<project_id>', methods=['GET'])
def get_project(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Proyek tidak ditemukan'}), 404
    return jsonify(project.to_dict()), 200

@projects_bp.route('', methods=['POST'])
def save_project():
    data = request.json
    project_id = data.get('id')
    
    project = Project.query.get(project_id) if project_id else None
    
    if project:
        project.name = data.get('name', project.name)
        project.circuit = data.get('circuit', project.circuit)
        project.history = data.get('history', project.history)
    else:
        project = Project(
            id=project_id or f"proj_{int(datetime.utcnow().timestamp() * 1000)}",
            name=data.get('name'),
            circuit=data.get('circuit'),
            history=data.get('history')
        )
        db.session.add(project)
    
    db.session.commit()
    return jsonify(project.to_dict()), 200

@projects_bp.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Proyek tidak ditemukan'}), 404
    
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Proyek berhasil dihapus'}), 200
