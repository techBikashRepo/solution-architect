/* ================================================================
   PDF DATA — Reference PDFs per subject
================================================================ */

export const PDFS = {
  "system-design": [
    {
      id: "sd-pdf-1",
      title: "Scaling From Zero To Millions",
      file: "001 Scaling_From_Zero_To_Millions.pdf",
      dir: "content/01-System-Design/pdf",
    },
    {
      id: "sd-pdf-2",
      title: "Back of the Envelope Mastery",
      file: "002 Back_of_the_Envelope_Mastery.pdf",
      dir: "content/01-System-Design/pdf",
    },
    {
      id: "sd-pdf-3",
      title: "System Design Interview Blueprint",
      file: "003 System_Design_Interview_Blueprint.pdf",
      dir: "content/01-System-Design/pdf",
    },
    {
      id: "sd-pdf-4",
      title: "Rate Limiter Design for Stability and Scale",
      file: "004 Rate_Limiter_Design_For_Stability_And_Scale.pdf",
      dir: "content/01-System-Design/pdf",
    },
    {
      id: "sd-pdf-5",
      title: "Consistent Hashing Deep Dive",
      file: "005 Consistent_Hashing_Deep_Dive.pdf",
      dir: "content/01-System-Design/pdf",
    },
    {
      id: "sd-pdf-6",
      title: "Distributed Key-Value Architecture",
      file: "006 Distributed_Key_Value_Architecture.pdf",
      dir: "content/01-System-Design/pdf",
    },
  ],
  "aws-cloud": [
    // Add PDFs to content/02-AWS-Cloud/pdf/ and list them here
  ],
  dsa: [
    // Add PDFs to content/03-DSA/pdf/ and list them here
  ],
};

/** Return all PDFs for a subject, or [] if none. */
export function getPdfs(subjectId) {
  return PDFS[subjectId] || [];
}

/** Find a single PDF by subjectId + pdfId. */
export function findPdf(subjectId, pdfId) {
  return (PDFS[subjectId] || []).find((p) => p.id === pdfId) || null;
}

/** Build the URL path to a PDF file. */
export function getPdfUrl(pdf) {
  return `${pdf.dir}/${pdf.file}`;
}
