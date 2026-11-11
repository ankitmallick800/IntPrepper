from flask import Flask, jsonify, request
from flask_cors import CORS

from app.config import Config
from app.database import init_app
from app.routes import register_blueprints


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config["DATABASE_PATH"] = config_class.DATABASE_PATH
    app.config["UPLOAD_FOLDER"] = config_class.UPLOAD_FOLDER

    CORS(
        app,
        supports_credentials=True,
        origins=config_class.CORS_ORIGINS,
    )

    init_app(app)
    register_blueprints(app)

    @app.errorhandler(404)
    def not_found(_error):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found."}), 404
        return jsonify({"error": "Not found."}), 404

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"error": "That recording is too large to upload."}), 413

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"error": "Something went wrong. Please try again."}), 500

    return app
