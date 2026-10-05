from datetime import datetime
from electrolab import db


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.String(100), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    circuit = db.Column(db.JSON, nullable=False)
    history = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "circuit": self.circuit,
            "history": self.history,
            "updated": self.updated_at.isoformat() if self.updated_at else None,
        }

class CalculationHistory(db.Model):
    __tablename__ = 'calc_history'
    id = db.Column(db.Integer, primary_key=True)
    operation = db.Column(db.String(100), nullable=False)
    input_data = db.Column(db.JSON, nullable=False)
    result = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'operation': self.operation,
            'input': self.input_data,
            'result': self.result,
            'created_at': self.created_at.isoformat()
        }
