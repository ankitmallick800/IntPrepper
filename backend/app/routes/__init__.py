from app.routes.ai import bp as ai_bp
from app.routes.health import bp as health_bp
from app.routes.interviews import bp as interviews_bp


def register_blueprints(app):
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(ai_bp, url_prefix="/api")
    app.register_blueprint(interviews_bp, url_prefix="/api")
