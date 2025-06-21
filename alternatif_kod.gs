function formatTurkishDate(yyyy_mm_dd) {
  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
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
  let sheet = ss.getSheetByName("Pubmed") || ss.insertSheet("Pubmed");
  sheet.clearContents();

  const headers = ["Makale Başlığı", "Dergi Adı", "Yayın Tarihi", "İlk Yazar", "PMID", "Veritabanına Giriş Tarihi (Entrez)"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

  const logSheet = ss.getSheetByName("PMID_Log") || ss.insertSheet("PMID_Log");
  if (logSheet.getLastRow() === 0) logSheet.appendRow(["PMID"]);

  // Eski kayıtlar
  let oldPMIDs = new Set();
  const lastRow = logSheet.getLastRow();
  if (lastRow > 1) {
    const values = logSheet.getRange(2, 1, lastRow - 1).getValues().flat();
    oldPMIDs = new Set(values.map(String));
  }

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

  let currentRow = 2;
  let newArticles = [];

  for (let journal of journals) {
    sheet.getRange(currentRow, 1).setValue(journal).setFontWeight("bold");
    currentRow++;

    const query = `journal:"${journal}"[Journal]`;
    const esearchUrl = `${baseSearchUrl}?db=pubmed&term=${encodeURIComponent(query)}&sort=pub+date&retmode=json&retmax=10`;

    try {
      const response = UrlFetchApp.fetch(esearchUrl);
      const data = JSON.parse(response.getContentText());
      const pmids = data.esearchresult.idlist;

      for (let pmid of pmids) {
        Utilities.sleep(350);  // API sınırına uymak için
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

        sheet.getRange(currentRow, 1, 1, 6).setValues([
          [title, fullJournal, pubDate, firstAuthor, pmid, entrezDate]
        ]);
        currentRow++;

        if (!oldPMIDs.has(pmid)) {
          newArticles.push({
            title, journal: fullJournal, date: pubDate, author: firstAuthor, pmid
          });
        }
      }
    } catch (e) {
      sheet.getRange(currentRow, 1).setValue("Hata: " + e.message).setFontColor("red");
      currentRow++;
    }
  }

  // Yeni gelen varsa log'a ekle + e-posta gönder
  if (newArticles.length > 0) {
    const newPMIDs = newArticles.map(a => [a.pmid]);
    logSheet.getRange(logSheet.getLastRow() + 1, 1, newPMIDs.length, 1).setValues(newPMIDs);

    const mailBody = newArticles.map(a => 
      `📌 ${a.title}\n📚 ${a.journal} (${a.date})\n👤 ${a.author}\n🔗 https://pubmed.ncbi.nlm.nih.gov/${a.pmid}\n`
    ).join("\n");

    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: "🔔 Yeni PubMed Makaleleri (Patoloji)",
      body: `Aşağıda yeni eklenen ${newArticles.length} makale listelenmiştir:\n\n${mailBody}`
    });
  }

  sheet.autoResizeColumns(1, headers.length);
  SpreadsheetApp.getActiveSpreadsheet().toast("Yeni PubMed makaleleri başarıyla çekildi.");
}
