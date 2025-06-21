# Pubmed Email Notifier 📬

Günlük olarak PubMed üzerinden 12 saygın patoloji dergisini tarayıp, en güncel makaleleri Google E-Tablolar kullanıcılarına e-posta ile bildiren bir **Google Apps Script uygulamasıdır**. Kod tamamen özelleştirilebilir ve kurulumu kolaydır.

## ✨ Özellikler
- Her sabah otomatik çalışır
- 12 dergiden son 10 yayını PubMed'den çeker
- Daha önce gönderilmemiş makaleleri saptar
- Yeni olanları e-posta ile bildirir
- Aynı yayını tekrar göndermez

## ✨ Kullanılan Dergiler
- Modern Pathology  
- Histopathology  
- American Journal of Surgical Pathology  
- Human Pathology  
- Virchows Archiv  
- Journal of Pathology  
- Annals of Diagnostic Pathology  
- Diagnostic Pathology  
- Pathology International  
- Pathology Research and Practice  
- International Journal of Surgical Pathology  
- American Journal of Clinical Pathology  

---

## 📚 Kurulum Adımları

### 1. Google Sheets Oluşturun
Yeni bir Google E-Tablosu oluşturun ve adını `Pubmed` yapın.

### 2. Script Editörüne Girin
- Üst menüden: “Uzantılar > Apps Script”
- Yeni proje oluşturun
- Aşağıdaki kodu yapıştırın

### 3. Script Dosyası: `pubmed.gs`

```javascript
function formatTurkishDate(yyyy_mm_dd) {
  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  if (!yyyy_mm_dd || typeof yyyy_mm_dd !== "string" || !yyyy_mm_dd.includes("/")) return "";
  const parts = yyyy_mm_dd.split("/");
  if (parts.length !== 3) return "";
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${monthNames[monthIndex]} ${year}`;
}

function fetchPubMedByJournals() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Pubmed") || ss.insertSheet("Pubmed");
  const logSheet = ss.getSheetByName("PMID_Log") || ss.insertSheet("PMID_Log");
  const logData = logSheet.getRange("A2:A").getValues().flat().filter(Boolean);

  sheet.clear();
  const headers = ["Makale Başlığı", "Dergi Adı", "Yayın Tarihi", "İlk Yazar", "PMID", "Giriş Tarihi"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

  const journals = [
    "Modern Pathology", "Histopathology", "American Journal of Surgical Pathology", "Human Pathology",
    "Virchows Archiv", "Journal of Pathology", "Annals of Diagnostic Pathology", "Diagnostic Pathology",
    "Pathology International", "Pathology Research and Practice", "International Journal of Surgical Pathology",
    "American Journal of Clinical Pathology"
  ];

  const baseSearchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  const baseSummaryUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

  let newItems = [];
  let currentRow = 2;

  for (let journal of journals) {
    const query = `journal:"${journal}"[Journal]`;
    const esearchUrl = `${baseSearchUrl}?db=pubmed&term=${encodeURIComponent(query)}&sort=pub+date&retmode=json&retmax=5`;

    try {
      const response = UrlFetchApp.fetch(esearchUrl);
      const data = JSON.parse(response.getContentText());
      const pmids = data.esearchresult.idlist;

      for (let pmid of pmids) {
        if (logData.includes(pmid)) continue;
        Utilities.sleep(300);

        const summaryUrl = `${baseSummaryUrl}?db=pubmed&retmode=json&id=${pmid}`;
        const article = JSON.parse(UrlFetchApp.fetch(summaryUrl).getContentText()).result[pmid];

        const title = article.title || "";
        const journalName = article.fulljournalname || "";
        const pubDate = article.pubdate || "";
        const firstAuthor = (article.authors && article.authors.length > 0) ? article.authors[0].name : "";
        let entrezDate = "";

        if (article.history && Array.isArray(article.history)) {
          const pubmedEntry = article.history.find(entry => entry.pubstatus === "pubmed");
          if (pubmedEntry && pubmedEntry.date) {
            entrezDate = formatTurkishDate(pubmedEntry.date.split(" ")[0]);
          }
        }

        sheet.getRange(currentRow, 1, 1, 6).setValues([
          [title, journalName, pubDate, firstAuthor, pmid, entrezDate]
        ]);
        currentRow++;

        newItems.push(`- ${title}\n${pubDate} (${journalName})\nhttps://pubmed.ncbi.nlm.nih.gov/${pmid}/\n`);
        logSheet.appendRow([pmid]);
      }
    } catch (e) {
      Logger.log("Hata: " + e.message);
    }
  }

  if (newItems.length > 0) {
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: "Yeni Patoloji Makaleleri Geldi!",
      body: `Bugün eklenen yeni makaleler:\n\n${newItems.join("\n")}`
    });
  }

  SpreadsheetApp.getActiveSpreadsheet().toast("PubMed güncellemesi tamamlandı");
}
```

### 4. Zamanlayıcı Ekle
- Apps Script üst menüden "Zamanlayıcılar"
- Yeni tetikleyici: `fetchPubMedByJournals`
- Tetikleme: Zaman bazlı > Günlük > Sabah saatlerinde

---

## 📅 Log Sayfası: `PMID_Log`
- Script, gönderdiği her yeni PMID'i buraya ekler.
- Aynı yayın bir daha gönderilmez.
- Fazla dolarsa, ilk 200 tanesini tutup kalanı silebilirsiniz.

---

## 🎓 Not
- Bu sistem yayın başlığı ve link dışında hiçbir içeriği kopyalamaz.
- Tüm linkler PubMed'e gider.
- Telif ihlali oluşturmaz.

---

## 👍 Katkı
Pull request ve önerilere açığız. 
Projeyi beğenirseniz ⭐ vermeyi unutmayın.

---
