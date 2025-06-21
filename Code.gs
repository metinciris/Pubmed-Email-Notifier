// 📁 Script dosyası: Code.gs (Google Apps Script)

function formatTurkishDate(yyyy_mm_dd) {
  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  if (!yyyy_mm_dd || typeof yyyy_mm_dd !== "string" || !yyyy_mm_dd.includes("/")) return "";
  const parts = yyyy_mm_dd.split("/");
  if (parts.length !== 3) return "";
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${monthNames[monthIndex]} ${year}`;
}

function fetchPubMedAndSend() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Pubmed") || ss.insertSheet("Pubmed");
  const logSheet = ss.getSheetByName("PMID_Log") || ss.insertSheet("PMID_Log");

  sheet.clearContents();
  const headers = ["Makale Başlığı", "Dergi Adı", "Yayın Tarihi", "İlk Yazar", "PMID", "Veritabanı Tarihi"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const journals = [
    "Modern Pathology",
    "Histopathology",
    "American Journal of Surgical Pathology",
    "Human Pathology",
    "Virchows Archiv",
    "Journal of Pathology",
    "Annals of Diagnostic Pathology",
    "Diagnostic Pathology",
    "Pathology International",
    "Pathology Research and Practice",
    "International Journal of Surgical Pathology",
    "American Journal of Clinical Pathology"
  ];

  const baseSearchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  const baseSummaryUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

  const knownPMIDs = logSheet.getRange("A2:A").getValues().flat().filter(String);
  let newPMIDs = [];
  let newArticles = [];

  for (let journal of journals) {
    const query = `journal:\"${journal}\"[Journal]`;
    const esearchUrl = `${baseSearchUrl}?db=pubmed&term=${encodeURIComponent(query)}&sort=pub+date&retmode=json&retmax=5`;

    try {
      const response = UrlFetchApp.fetch(esearchUrl);
      const data = JSON.parse(response.getContentText());
      const pmids = data.esearchresult.idlist;

      for (let pmid of pmids) {
        if (knownPMIDs.includes(pmid)) continue;

        Utilities.sleep(300);
        const summaryUrl = `${baseSummaryUrl}?db=pubmed&retmode=json&id=${pmid}`;
        const summaryData = JSON.parse(UrlFetchApp.fetch(summaryUrl).getContentText());
        const article = summaryData.result[pmid];

        const title = article.title || "";
        const fullJournal = article.fulljournalname || "";
        const pubDate = article.pubdate || "";
        const firstAuthor = (article.authors && article.authors.length > 0) ? article.authors[0].name : "";
        let entrezDate = "";

        if (article.history && Array.isArray(article.history)) {
          const pubmedEntry = article.history.find(entry => entry.pubstatus === "pubmed");
          if (pubmedEntry && pubmedEntry.date) {
            entrezDate = formatTurkishDate(pubmedEntry.date.split(" ")[0]);
          }
        }

        newPMIDs.push(pmid);
        newArticles.push([title, fullJournal, pubDate, firstAuthor, pmid, entrezDate]);
      }
    } catch (e) {
      Logger.log("Hata: " + e.message);
    }
  }

  if (newArticles.length > 0) {
    sheet.getRange(2, 1, newArticles.length, headers.length).setValues(newArticles);
    logSheet.getRange(logSheet.getLastRow() + 1, 1, newPMIDs.length, 1).setValues(newPMIDs.map(id => [id]));

    const body = newArticles.map(row => `• ${row[0]} (${row[1]})\nhttps://pubmed.ncbi.nlm.nih.gov/${row[4]}/`).join("\n\n");
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: "🧪 Yeni Patoloji Makaleleri Geldi!",
      body: `Aşağıdaki yeni makaleler tespit edildi:\n\n${body}`
    });
  }
}
