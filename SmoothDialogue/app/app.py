from flask import Flask, request, render_template, jsonify, session
import boto3
import json
import os

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "supersecretkey")

# Bedrock client using iesb profile credentials (mounted via volume)
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
)

MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")

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


@app.route('/greet', methods=['POST'])
def greet():
    user = request.form.get('user', '').strip()
    if user and user not in session['greeted']:
        session['greeted'].append(user)
        return jsonify({"greeting": f"Oi, {user}!"})
    return jsonify({"greeting": ""})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
