"""Mantiene la galería GhostArt: normaliza img/, genera miniaturas y manifest.json.

Lo ejecuta la GitHub Action en cada push (también se puede lanzar en local):

    python tools/ghostart.py

Qué hace, de forma idempotente:
  1. Cualquier imagen de img/ que no sea WebP (o tenga un nombre con espacios,
     tildes o mayúsculas) se convierte a img/<carpeta>/<nombre-limpio>.webp y se
     borra el original. Si es más grande de MAX_LADO px se reduce.
  2. Crea thumbs/<misma ruta>.webp para las imágenes que no la tengan y borra
     las miniaturas huérfanas.
  3. Reescribe manifest.json conservando la fecha en que entró cada imagen.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
IMG = RAIZ / "img"
THUMBS = RAIZ / "thumbs"
MANIFEST = RAIZ / "manifest.json"

EXTENSIONES = {".webp", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff", ".avif"}
MAX_LADO = 2560
CALIDAD = 82
THUMB_LADO = 640
THUMB_CALIDAD = 72


def limpiar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return re.sub(r"-{2,}", "-", t) or "imagen"


def abrir_rgb(path: Path) -> Image.Image:
    im = ImageOps.exif_transpose(Image.open(path))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        if im.getextrema()[3][0] < 255:  # tiene transparencia real: se conserva
            return im
    return im.convert("RGB")


def guardar_webp(im: Image.Image, dst: Path, lado: int, calidad: int) -> None:
    im = im.copy()
    im.thumbnail((lado, lado), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".tmp")
    im.save(tmp, "WEBP", quality=calidad, method=4)
    tmp.replace(dst)


def destino_libre(dst: Path, origen: Path) -> Path:
    """Evita pisar una imagen distinta que ya tenga ese nombre."""
    n = 2
    final = dst
    while final.exists() and final.resolve() != origen.resolve():
        final = dst.with_name(f"{dst.stem}-v{n}{dst.suffix}")
        n += 1
    return final


def normalizar(origen: Path) -> Path:
    rel = origen.relative_to(IMG)
    carpetas = [limpiar(p) for p in rel.parts[:-1]]
    dst = IMG.joinpath(*carpetas, limpiar(origen.stem) + ".webp")
    if dst == origen:
        return origen
    dst = destino_libre(dst, origen)
    if origen.suffix.lower() == ".webp" and Image.open(origen).size[0] <= MAX_LADO:
        dst.parent.mkdir(parents=True, exist_ok=True)
        origen.replace(dst)  # solo cambia el nombre
    else:
        guardar_webp(abrir_rgb(origen), dst, MAX_LADO, CALIDAD)
        origen.unlink()
    print(f"  normalizada: {rel.as_posix()} -> {dst.relative_to(IMG).as_posix()}")
    return dst


def borrar_carpetas_vacias(base: Path) -> None:
    for d in sorted((p for p in base.rglob("*") if p.is_dir()), key=lambda p: -len(p.parts)):
        if not any(d.iterdir()):
            d.rmdir()


def main() -> int:
    IMG.mkdir(exist_ok=True)
    THUMBS.mkdir(exist_ok=True)

    previo = {}
    if MANIFEST.exists():
        try:
            previo = {i["p"]: i for i in json.loads(MANIFEST.read_text(encoding="utf-8"))["images"]}
        except (ValueError, KeyError):
            pass

    imagenes = []
    for f in sorted(p for p in IMG.rglob("*") if p.is_file()):
        if f.suffix.lower() not in EXTENSIONES:
            continue
        try:
            imagenes.append(normalizar(f))
        except OSError as e:
            print(f"  AVISO: no se pudo procesar {f.relative_to(RAIZ)}: {e}", file=sys.stderr)
    imagenes = sorted(set(imagenes))
    borrar_carpetas_vacias(IMG)

    esperadas = set()
    hoy = date.today().isoformat()
    items = []
    for f in imagenes:
        rel = f.relative_to(IMG).as_posix()
        thumb = THUMBS / rel
        esperadas.add(thumb)
        if not thumb.exists() or thumb.stat().st_mtime < f.stat().st_mtime:
            guardar_webp(abrir_rgb(f), thumb, THUMB_LADO, THUMB_CALIDAD)
        with Image.open(f) as im:
            w, h = im.size
        p = f"img/{rel}"
        partes = rel.split("/")
        items.append({
            "p": p,
            "t": f"thumbs/{rel}",
            "c": partes[0] if len(partes) > 1 else "",
            "n": f.stem,
            "w": w,
            "h": h,
            "s": f.stat().st_size,
            "d": previo.get(p, {}).get("d", hoy),
        })

    for t in THUMBS.rglob("*"):
        if t.is_file() and t not in esperadas:
            t.unlink()
    borrar_carpetas_vacias(THUMBS)

    if [previo.get(i["p"]) for i in items] == items and len(previo) == len(items):
        print(f"manifest.json sin cambios: {len(items)} imágenes")
        return 0  # no se reescribe: así un push sin imágenes nuevas no genera un commit vacío
    MANIFEST.write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(items),
        "images": items,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"manifest.json: {len(items)} imágenes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
