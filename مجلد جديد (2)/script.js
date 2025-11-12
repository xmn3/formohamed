// script.js — كامل للتعامل مع واجهة الترحيب، حفظ على الخادم، وطلب التنبؤ
// افترض أن app.py يعمل على http://127.0.0.1:5000 مع endpoints /append و /predict
// وظائف: قراءة الحقول (العمر، الوزن، الطول)، التحقق، حفظ محلي (CSV download) وخيارات الإرسال للخادم، عرض النتيجة

const el = id => document.getElementById(id);

// حالة جلسة مؤقتة
window.currentRecord = null;
window.csvData = null; // إن رغبت بتحميل CSV لاحقاً

/* ------------------ دوال مساعدة ------------------ */
function readInputs() {
  const age = el('inputAge')?.value ? Number(el('inputAge').value) : null;
  const weight = el('inputWeight')?.value ? Number(el('inputWeight').value) : null;
  const height = el('inputHeight')?.value ? Number(el('inputHeight').value) : null;
  return { Age: age, Weight: weight, Height_cm: height };
}

function validate(record) {
  if (!record) return false;
  if (record.Age == null || record.Weight == null || record.Height_cm == null) {
    alert('رجاءً أدخل العمر والوزن والطول'); return false;
  }
  if (record.Age <= 0 || record.Weight <= 0 || record.Height_cm <= 0) {
    alert('القيم يجب أن تكون أكبر من الصفر'); return false;
  }
  return true;
}

/* ------------------ حفظ محلي: تنزيل CSV محدث ------------------ */
function downloadCsvWithNewRecord(newRec) {
  const headers = ['Age','Weight','Height_cm'];
  const rows = [headers.join(',')];

  // إذا هناك بيانات سابقة محمّلة، ندرجها أولاً (اختياري)
  if (Array.isArray(window.csvData) && window.csvData.length > 0) {
    window.csvData.forEach(r => {
      rows.push(headers.map(h => (r[h] !== undefined && r[h] !== null) ? r[h] : '').join(','));
    });
  }

  // أضف السجل الجديد في النهاية
  rows.push([newRec.Age, newRec.Weight, newRec.Height_cm].join(','));

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bodyfat-updated.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert('تم تحميل CSV محدث على جهازك.');
}

/* ------------------ دوال الاتصال بالخادم ------------------ */
async function saveToServer(rec) {
  try {
    const res = await fetch('http://127.0.0.1:5000/append', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(rec)
    });
    const j = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(j));
    alert('تم الحفظ على الخادم بنجاح.');
    return j;
  } catch (e) {
    console.error('saveToServer error', e);
    alert('فشل الحفظ على الخادم: ' + (e.message || e));
    return null;
  }
}

async function callPredict(rec) {
  try {
    const res = await fetch('http://127.0.0.1:5000/predict', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(rec)
    });
    const j = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(j));
    return j.prediction;
  } catch (e) {
    console.error('callPredict error', e);
    alert('فشل التنبؤ: ' + (e.message || e));
    return undefined;
  }
}

/* ------------------ تزامن واجهة المستخدم مع الأحداث ------------------ */
document.addEventListener('DOMContentLoaded', () => {
  // أزرار النموذج
  const startBtn = el('startBtn');
  const saveLocalBtn = el('saveLocalBtn');
  const loadMyRecordBtn = el('loadMyRecordBtn');
  const fileInput = el('fileInput'); // خيار تحميل CSV محلي من المستخدم (إذا موجود في HTML)
  const predictResultEl = el('predictResult');

  // زر الإرسال: يخزن السجل مؤقتاً ثم يطلب التنبؤ من الخادم ويعرضه
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      const rec = readInputs();
      if (!validate(rec)) return;
      window.currentRecord = rec;

      // عرض رسالة تحضيرية
      predictResultEl.innerText = 'جاري طلب التنبؤ...';

      // اطلب التنبؤ من الخادم
      const pred = await callPredict(rec);
      if (pred !== undefined) {
        predictResultEl.innerText = 'Predicted BodyFat: ' + pred;
      } else {
        predictResultEl.innerText = 'لم يتم الحصول على نتيجة من الخادم.';
      }
    });
  }

  // زر الحفظ المحلي: ينزل CSV محدث على جهاز المستخدم
  if (saveLocalBtn) {
    saveLocalBtn.addEventListener('click', () => {
      const rec = readInputs();
      if (!validate(rec)) return;
      downloadCsvWithNewRecord(rec);
    });
  }

  // زر لتحميل CSV محلي (اختياري) ثم البحث عن سجل المستخدم داخل الملف
  if (loadMyRecordBtn && fileInput) {
    loadMyRecordBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      // استخدام PapaParse إن أضفتها في الصفحة؛ إن لم تكن موجودة يمكن قراءته يدوياً
      if (window.Papa) {
        Papa.parse(f, {
          header: true, skipEmptyLines: true,
          complete(results) {
            window.csvData = results.data.map(r => {
              Object.keys(r).forEach(k => {
                const v = (r[k] ?? '').toString().trim();
                if (v === '') r[k] = null;
                else if (!isNaN(v)) r[k] = Number(v);
              });
              return r;
            });
            findAndShowUserRecordUI();
          },
          error(err) { console.error('Papa parse error', err); alert('خطأ في قراءة الملف'); }
        });
      } else {
        alert('PapaParse غير موجودة. لإتاحة تحميل CSV أضف مكتبة PapaParse في index.html');
      }
    });
  }

  // دالة بحث وعرض نتيجة من CSV محلي (عرض محدود للمستخدم فقط)
  function findAndShowUserRecordUI() {
    if (!window.csvData || !window.currentRecord) {
      alert('ارفع ملف CSV وأدخل بياناتك أولاً.');
      return;
    }
    const nameField = 'Name'; // لو ملفك يحتوي اسم، ويمكن تعديل البحث حسب الحقول المتاحة
    // أولاً نحاول المطابقة بالعمر والوزن
    const age = window.currentRecord.Age;
    const weight = window.currentRecord.Weight;
    const matches = window.csvData.filter(r => {
      const ageDiff = Math.abs((r.Age || 0) - age);
      const weightDiff = Math.abs((r.Weight || 0) - weight);
      return ageDiff <= 2 && weightDiff <= 3;
    });
    if (matches.length === 0) {
      alert('لم يُعثر على سجل مطابق في الملف المحلي.');
      return;
    }
    // عرض النتائج: سنعرض جدول بسيط داخل عنصر tableSection الموجود في HTML
    const tableSection = el('tableSection');
    const tableHead = el('tableHead');
    const tableBody = el('tableBody');
    if (!tableSection || !tableHead || !tableBody) {
      alert('عنصر الجدول غير موجود في الواجهة لعرض النتائج.');
      return;
    }
    tableSection.style.display = 'block';
    const cols = Object.keys(matches[0]);
    tableHead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
    tableBody.innerHTML = matches.map(r => '<tr>' + cols.map(c => `<td>${r[c] ?? ''}</td>`).join('') + '</tr>').join('');
  }
});