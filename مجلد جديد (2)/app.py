from flask import Flask, request, jsonify
from flask_cors import CORS
import csv, os

app = Flask(__name__)
CORS(app)

CSV_PATH = 'bodyfat-Copy1.csv'
FIELDNAMES = ['Age', 'Weight', 'Height_cm']  # الحقول اللي نحفظها

def validate_payload(d):
    try:
        age = int(d.get('Age',0)); weight = float(d.get('Weight',0)); height = float(d.get('Height_cm',0))
        return age>0 and weight>0 and height>0
    except:
        return False

@app.route('/')
def hello():
    return 'OK'

@app.route('/append', methods=['POST'])
def append_record():
    data = request.get_json(force=True)
    if not validate_payload(data):
        return jsonify({'error':'invalid data'}), 400

    file_exists = os.path.isfile(CSV_PATH)
    with open(CSV_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if not file_exists:
            writer.writeheader()
        writer.writerow({k: data.get(k, '') for k in FIELDNAMES})

    return jsonify({'status':'ok'}), 201

@app.route('/predict', methods=['POST'])
def predict():
    # placeholder بسيط: حساب BMI ثم تقدير BodyFat تقريبي (غير مدرّب)
    data = request.get_json(force=True)
    try:
        age = float(data.get('Age'))
        weight = float(data.get('Weight'))
        height = float(data.get('Height_cm'))
    except:
        return jsonify({'error':'invalid data'}), 400

    bmi = weight / ((height/100)**2)
    # تقدير بدائي للاختبار فقط (لما تحط الموديل استبدل هذا الجزء)
    predicted_bodyfat = 0.1 * bmi + 0.05 * age
    return jsonify({'prediction': round(predicted_bodyfat, 3)})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)