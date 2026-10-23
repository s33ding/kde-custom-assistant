from flask import Flask, request, render_template, jsonify, session
import boto3
import json

from config import Config

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY

# Bedrock client using iesb profile credentials (mounted via volume)
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=Config.AWS_REGION,
)

MODEL_ID = Config.BEDROCK_MODEL_ID

# Função para melhorar a comunicação escrita
def improve_communication(text):
    if not text:
        return "O texto não pode estar vazio."

    system_prompt = (
        "Você é um revisor de texto. Sua tarefa é reescrever mensagens informais em português "
        "para ficarem claras, profissionais e empáticas. Use 1-2 emojis. "
        "Preserve termos técnicos em inglês. "
        "Regras: retorne APENAS a mensagem reescrita. Sem explicações, sem opções, sem perguntas, sem markdown."
    )

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 300,
        "temperature": 0.2,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": f"Reescreva esta mensagem:\n\n{text}"},
            {"role": "assistant", "content": ""}
        ]
    })

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    result = json.loads(response["body"].read())
    return result["content"][0]["text"].strip()


# Extrai texto de uma imagem (OCR) via Bedrock (Claude com visão)
def image_to_text(media_type, image_b64):
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1000,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extraia TODO o texto presente nesta imagem. Retorne apenas o texto extraído, sem comentários.",
                    },
                ],
            }
        ],
    })

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    result = json.loads(response["body"].read())
    return result["content"][0]["text"].strip()


@app.route('/', methods=['GET', 'POST'])
def index():
    if 'greeted' not in session:
        session['greeted'] = []

    if request.method == 'POST':
        input_text = request.form.get('text', '').strip()
        if not input_text:
            return jsonify({"error": "O texto não pode estar vazio."}), 400

        improved_text = improve_communication(input_text)
        return jsonify({"corrected_text": improved_text})

    return render_template('index.html')


@app.route('/ocr', methods=['POST'])
def ocr():
    data = request.get_json(silent=True) or {}
    image = (data.get('image') or '').strip()
    # Accept a data URL (data:image/png;base64,....) or raw base64
    media_type = "image/png"
    if image.startswith("data:"):
        try:
            header, image = image.split(",", 1)
            media_type = header.split(";")[0].replace("data:", "") or media_type
        except ValueError:
            return jsonify({"error": "Imagem inválida."}), 400
    if not image:
        return jsonify({"error": "Nenhuma imagem enviada."}), 400

    try:
        text = image_to_text(media_type, image)
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": "Falha no OCR.", "detail": str(e)}), 500


@app.route('/greet', methods=['POST'])
def greet():
    user = request.form.get('user', '').strip()
    if user and user not in session['greeted']:
        session['greeted'].append(user)
        return jsonify({"greeting": f"Oi, {user}!"})
    return jsonify({"greeting": ""})


@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json(silent=True) or {}
    messages = data.get('messages') or []
    system = data.get('system') or "Você é um assistente prestativo e amigável. Responda de forma clara e concisa."
    # Keep only role/content and valid roles for the Anthropic/Bedrock API
    clean = [
        {"role": m.get("role"), "content": m.get("content", "")}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    if not clean:
        return jsonify({"error": "messages vazio."}), 400

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 500,
        "temperature": 0.6,
        "system": system,
        "messages": clean,
    })
    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        result = json.loads(response["body"].read())
        return jsonify({"reply": result["content"][0]["text"].strip()})
    except Exception as e:
        return jsonify({"error": "Falha no chat.", "detail": str(e)}), 500


if __name__ == '__main__':
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
