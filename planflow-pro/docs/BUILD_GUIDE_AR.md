# دليل بناء وتركيب PlanFlow Pro على جهازك (خطوة بخطوة)

هذا الدليل لتشغيل الكود الموجود في `planflow-pro/` كإضافة حقيقية على إكسل عندك.
محتاج جهاز **Windows** فيه **Microsoft Excel** مثبت (Desktop، مش نسخة الويب).

---

## المتطلبات قبل ما تبدأ

| المتطلب | ليه محتاجه | رابط التحميل |
|---|---|---|
| Windows 10/11 (64-bit) | Excel-DNA و Interop شغالين على ويندوز بس | — |
| Microsoft Excel (Desktop) | الإضافة بتشتغل جواه | — |
| .NET SDK 8.0 (أو أحدث) | لبناء المشروع وتشغيل الاختبارات | https://dotnet.microsoft.com/download |
| Git (اختياري) | لتنزيل الكود بدل الـ ZIP | https://git-scm.com/downloads |

---

## الخطوة 1: نزّل الكود

**الطريقة الأسهل (بدون Git):**
1. افتح صفحة المستودع على GitHub.
2. اختار الفرع `claude/new-session-5gqjdt` من قائمة الفروع (Branch).
3. اضغط الزر الأخضر **Code** → **Download ZIP**.
4. فك الضغط (Extract) في مكان سهل، مثلاً: `C:\PlanFlowPro`.

**أو بـ Git:**
```
git clone -b claude/new-session-5gqjdt https://github.com/mhamdelhefnawy-sys/mhamd.git C:\PlanFlowPro
```

المجلد اللي هتشتغل جواه دايمًا هو: `C:\PlanFlowPro\planflow-pro`

---

## الخطوة 2: ثبّت .NET SDK

1. افتح https://dotnet.microsoft.com/download
2. نزّل **.NET SDK 8.0** (النسخة اللي مكتوب عليها "SDK" مش "Runtime").
3. شغّل الملف اللي نزل (`dotnet-sdk-8.0.xxx-win-x64.exe`) واعمل Next / Install / Finish.
4. تأكد إنه اتثبت صح: افتح **PowerShell** أو **Command Prompt** واكتب:
   ```
   dotnet --version
   ```
   المفروض يطلعلك رقم زي `8.0.xxx`. لو ظهر خطأ "not recognized"، أعد تشغيل الجهاز وجرّب تاني (أحيانًا الـ PATH محتاج إعادة تشغيل).

---

## الخطوة 3: افتح المشروع من الـ Terminal

1. افتح **PowerShell**.
2. روح لمجلد المشروع:
   ```
   cd C:\PlanFlowPro\planflow-pro
   ```

---

## الخطوة 4: نزّل الحزم (Restore)

```
dotnet restore
```

هيحمّل الحزم المطلوبة (Excel-DNA, ClosedXML, xUnit...) من الإنترنت. محتاج اتصال إنترنت شغال.

**لو ظهر خطأ شبكة:** تأكد إنك مش خلف بروكسي/فايروول بيمنع nuget.org.

---

## الخطوة 5: شغّل الاختبارات (اختياري بس مهم)

```
dotnet test tests/PlanFlow.Core.Tests
```

المفروض يطلعلك في الآخر حاجة زي:
```
Passed!  - Failed: 0, Passed: XX, Skipped: 0
```

لو ظهرت أخطاء بناء (compile errors)، ابعتلي رسالة الخطأ بالظبط وهساعدك تصلحها — الكود اتكتب في بيئة معندهاش .NET أصلاً فمحتمل يطلع تفاصيل بسيطة محتاجة تعديل.

---

## الخطوة 6: ابني الإضافة نفسها

```
dotnet build src/PlanFlow.ExcelAddIn -c Release
```

لو نجح البناء، هيتكوّن الملف اللي محتاجه هنا:
```
C:\PlanFlowPro\planflow-pro\src\PlanFlow.ExcelAddIn\bin\Release\net48\PlanFlow.ExcelAddIn-AddIn64.xll
```

(لو عندك Excel 32-bit مش 64-bit، هيكون فيه كمان ملف `PlanFlow.ExcelAddIn-AddIn.xll` للـ 32-bit — استخدم اللي يطابق نسخة الأوفيس عندك. تقدر تعرف نسخة الأوفيس من: Excel → File → Account → About Excel، هتلاقي مكتوب "64-bit" أو "32-bit".)

---

## الخطوة 7: لو ويندوز حظر الملف (شائع جدًا)

ملفات منزّلة من الإنترنت أحيانًا ويندوز بيعمّلها "Block" تلقائيًا. لفكها:
1. كليك يمين على ملف `.xll` → **Properties**.
2. لو لاقيت في الأسفل جملة "This file came from another computer and might be blocked..." مع تشيك بوكس **Unblock** → علّم عليها.
3. اضغط **OK**.

---

## الخطوة 8: ضيف الإضافة على إكسل

1. افتح Excel.
2. **File** → **Options** → **Add-ins**.
3. في الأسفل، عند **Manage:** اختار **Excel Add-ins** → اضغط **Go...**.
4. في النافذة اللي هتفتح، اضغط **Browse...**.
5. روح للمسار في الخطوة 6 واختار ملف `PlanFlow.ExcelAddIn-AddIn64.xll` → **OK**.
6. تأكد إن التشيك بوكس بتاعه متعلّم (✔) → **OK**.

هيظهرلك تاب جديد اسمه **"PlanFlow Pro"** في أعلى شريط إكسل (الريبون)، جنب Home وInsert.

---

## الخطوة 9: أول تجربة

1. افتح ورقة إكسل فيها بيانات BOQ (أعمدة زي: Code, Description, Unit, Quantity, Rate) في الشيت النشط.
2. من تاب **PlanFlow Pro** → مجموعة **Import / BOQ** → اضغط **Load BOQ**.
3. هيتعمل شيت اسمه `Input_BOQ` فيه البيانات بعد التحقق، وشيت `Validation_Report` لو فيه أخطاء.
4. جرّب **Generate Activities** من مجموعة **Assistant** لتوليد اقتراحات أنشطة.

---

## مشاكل شائعة وحلولها

| المشكلة | الحل |
|---|---|
| التاب "PlanFlow Pro" مش ظاهر بعد الإضافة | تأكد إنك اخترت ملف `.xll` المطابق لنسخة Excel (32/64-bit)، وإن التشيك بوكس متعلّم في Add-ins list |
| رسالة "Excel found a problem with content" | افتح Trust Center: File → Options → Trust Center → Trust Center Settings → Add-ins → شيل تحديد "Require Application Add-ins to be signed" مؤقتًا |
| خطأ عند `dotnet build` بخصوص Microsoft.Office.Interop.Excel | لازم يكون عندك Microsoft Office نفسه مثبت على نفس الجهاز وقت البناء (Interop بيعتمد على مكتبات الأوفيس المحلية) |
| `dotnet restore` بطيء أو فاشل | تأكد من الإنترنت، أو جرّب `dotnet nuget locals all --clear` ثم أعد `dotnet restore` |
| الملف اتعمله Block ومش راضي يتفك | جرّب من PowerShell: `Unblock-File -Path "المسار\PlanFlow.ExcelAddIn-AddIn64.xll"` |

---

## ملاحظة مهمة

الكود ده لسه في **المرحلة الأولى والتانية (MVP + Phase 2)** من الخطة الكاملة — يعني زرار "Import XER" مثلاً وزرار "Number Activities" لسه مش شغالين (هيطلعوا رسالة "planned for a later phase"). التفاصيل كاملة في `docs/STATUS.md` جوه نفس المجلد.

لو واجهت أي خطأ فعلي أثناء التنفيذ (رسالة compile error، أو الإضافة مش بتظهر)، ابعتلي نص الرسالة بالظبط وهحلها معاك خطوة بخطوة.
