import { wordCount } from "@/lib/utils";
import { OUTPUT_JSON_SCHEMA_DESCRIPTION } from "./schema";
import {
  PROMPT_TEMPLATE_V2_SYSTEM,
  PROMPT_TEMPLATE_V2_NAME,
  PROMPT_TEMPLATE_V2_VERSION_LABEL,
} from "./templates/v2-news-seo-editor";
import {
  PROMPT_TEMPLATE_V3_SYSTEM,
  PROMPT_TEMPLATE_V3_NAME,
  PROMPT_TEMPLATE_V3_VERSION_LABEL,
} from "./templates/v3-nasional-media";
import {
  PROMPT_TEMPLATE_V4_SYSTEM,
  PROMPT_TEMPLATE_V4_NAME,
  PROMPT_TEMPLATE_V4_VERSION_LABEL,
} from "./templates/v4-paraphrase";

/** Fallback system prompt if DB template missing — prefer nasional media v3 */
export const DEFAULT_SYSTEM_PROMPT = PROMPT_TEMPLATE_V3_SYSTEM;

export {
  PROMPT_TEMPLATE_V2_SYSTEM,
  PROMPT_TEMPLATE_V2_NAME,
  PROMPT_TEMPLATE_V2_VERSION_LABEL,
  PROMPT_TEMPLATE_V3_SYSTEM,
  PROMPT_TEMPLATE_V3_NAME,
  PROMPT_TEMPLATE_V3_VERSION_LABEL,
  PROMPT_TEMPLATE_V4_SYSTEM,
  PROMPT_TEMPLATE_V4_NAME,
  PROMPT_TEMPLATE_V4_VERSION_LABEL,
};

export type ProcessMode = "optimize" | "paraphrase";

export function buildUserPrompt(input: {
  rawDraft: string;
  categories: string[];
  mode?: ProcessMode;
  sourceUrl?: string | null;
}): string {
  const mode: ProcessMode = input.mode === "paraphrase" ? "paraphrase" : "optimize";
  const words = wordCount(input.rawDraft);
  const categoriesList =
    input.categories.length > 0
      ? input.categories.join(" | ")
      : "Lainnya";
  const allowHeadings = words > 600;
  const looksLikeExplainer =
    /\b(cara|panduan|tips|apa itu|bagaimana|penjelasan|mengapa|definisi)\b/i.test(
      input.rawDraft
    );

  // Light location hint for dateline-style templates (no invention — model still must use draft only)
  const regionHint =
    input.rawDraft.match(
      /\b(Jakarta|Surabaya|Bandung|Medan|Makassar|Semarang|Yogyakarta|Jogja|Denpasar|Bali|Aceh|Medan|Palembang|Padang|Pekanbaru|Balikpapan|Samarinda|Pontianak|Manado|Ambon|Jayapura|Kupang|Mataram|Banjarmasin|Malang|Solo|Surakarta|Bogor|Depok|Tangerang|Bekasi|Jawa Barat|Jawa Tengah|Jawa Timur|Sumatera|Kalimantan|Sulawesi|Papua)\b/i
    )?.[1] ?? null;

  const sourceLine = input.sourceUrl
    ? `- URL sumber (metadata saja, jangan copy teks dari URL): ${input.sourceUrl}`
    : "- URL sumber: (tidak ada — draf buatan sendiri / tempel manual)";

  if (mode === "paraphrase") {
    return `PARAFASE artikel berikut. Tulis ulang dengan wording & struktur berbeda; fakta tetap sama. Output JSON sesuai skema.

### KONTEKS MESIN
- Mode: PARAFASE (bukan optimasi ringan)
- Jumlah kata sumber: ${words}
- Target panjang hasil: 85–115% kata sumber
- Heading H2/H3: ${
      allowHeadings
        ? "IZINKAN — hanya untuk subtopik yang sudah ada di sumber"
        : "DILARANG — sumber ≤ 600 kata; jangan gunakan <h2> atau <h3>"
    }
- FAQ: ${
      looksLikeExplainer
        ? "Kandidat explainer — boleh isi faq jika relevan; jika ragu biarkan []"
        : "Kemungkinan hard news — default faq = []"
    }
- Petunjuk lokasi (verifikasi di teks): ${
      regionHint
        ? `${regionHint} — boleh dateline "Daerah — " bila fakta mendukung`
        : "tidak terdeteksi — jangan mengarang kota"
    }
${sourceLine}
- Kategori WordPress (pilih SATU exact match; fallback "Lainnya"):
  ${categoriesList}

### TEKS SUMBER (satu-satunya sumber fakta — parafrase ini)
---
${input.rawDraft}
---

### SKEMA JSON (wajib diikuti)
${OUTPUT_JSON_SCHEMA_DESCRIPTION}

### CHECKLIST PARAFASE
- [ ] content benar-benar ditulis ulang (bukan near-duplicate)
- [ ] Semua nama/angka/tanggal/kutipan sama dengan sumber
- [ ] Tidak ada fakta/narasumber baru
- [ ] title & meta beda wording dari sumber (jika sumber punya judul di baris awal)
- [ ] alternative_titles berisi 4 item
- [ ] wordpress.status = "draft"
- [ ] Output murni JSON object, tanpa backticks

Kembalikan HANYA objek JSON valid.`;
  }

  return `Proses draf artikel berita berikut sesuai aturan system prompt (gaya media nasional bila template mensyaratkan).

### KONTEKS MESIN
- Mode: OPTIMASI SEO / EDITORIAL
- Jumlah kata draf: ${words}
- Heading H2/H3: ${
    allowHeadings
      ? "IZINKAN — tambahkan H2/H3 untuk merapikan struktur (hanya subtopik yang sudah ada di draf)"
      : "DILARANG — artikel ≤ 600 kata; jangan gunakan <h2> atau <h3>"
  }
- FAQ: ${
    looksLikeExplainer
      ? "Kandidat explainer — boleh isi faq jika benar-benar relevan; jika ragu biarkan []"
      : "Kemungkinan hard news — default faq = [] kecuali draf jelas panduan/penjelasan"
  }
- Petunjuk lokasi dari draf (jika terdeteksi, verifikasi di teks): ${
    regionHint
      ? `${regionHint} — gunakan untuk dateline "Daerah — " di lead/content bila sesuai fakta draf`
      : "tidak terdeteksi otomatis — cari lokasi di draf; jangan mengarang kota"
  }
${sourceLine}
- Kategori WordPress yang tersedia (pilih SATU string yang sama persis; fallback "Lainnya"):
  ${categoriesList}

### DRAF MENTAH (sumber fakta satu-satunya)
---
${input.rawDraft}
---

### SKEMA JSON (wajib diikuti; tipe & batasan)
${OUTPUT_JSON_SCHEMA_DESCRIPTION}

### CHECKLIST SEBELUM KIRIM
- [ ] Lead & paragraf pertama content diawali "NamaDaerah — " jika daerah ada di draf
- [ ] Semua nama/angka/tanggal di content masih sama dengan draf
- [ ] Tidak ada fakta/kutipan/narasumber baru
- [ ] title ≤ ~60–70 karakter; meta_description ≤ 155; excerpt ≤ 30 kata; summary ≤ 40 kata
- [ ] alternative_titles berisi 4 item
- [ ] tags memuat nama daerah (jika ada)
- [ ] wordpress.status = "draft"
- [ ] Output murni JSON object, tanpa backticks

Kembalikan HANYA objek JSON valid.`;
}

export function buildCorrectivePrompt(
  rawDraft: string,
  invalidJson: string,
  errors: string[]
): string {
  return `Output JSON sebelumnya TIDAK VALID. Perbaiki menjadi JSON yang memenuhi skema dan aturan fakta.

### KESALAHAN VALIDATOR
${errors.map((e) => `- ${e}`).join("\n")}

### DRAF ASLI (sumber fakta — jangan tambah entitas baru)
---
${rawDraft.slice(0, 12000)}
---

### OUTPUT SEBELUMNYA (perbaiki, jangan mulai dari nol jika masih bisa diselamatkan)
---
${invalidJson.slice(0, 8000)}
---

### PERBAIKAN WAJIB
1. JSON parseable, key lengkap sesuai skema.
2. Tidak menambah fakta di luar draf.
3. wordpress.status = "draft".
4. Tanpa markdown fence.

Kembalikan HANYA objek JSON valid.`;
}
