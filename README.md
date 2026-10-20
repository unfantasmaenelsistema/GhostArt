<div align="center">
  <img src="assets/logo.png" alt="Un Fantasma en el Sistema" width="110">

# GhostArt

[![Imágenes: CC BY 4.0](https://img.shields.io/badge/im%C3%A1genes-CC%20BY%204.0-c084fc)](LICENSE-IMAGES.md)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-4ade80)](LICENSE)

**Banco de ilustraciones estilo anime de ciberseguridad** de [Un Fantasma en el Sistema](https://www.unfantasmaenelsistema.com), para reutilizar en artículos y vídeos.

▶ **Abrir la galería:** https://unfantasmaenelsistema.github.io/GhostArt/

</div>

## Qué tiene

- Rejilla con miniaturas ligeras, buscador por tema (sin importar tildes) y filtros por categoría.
- Visor a pantalla completa con flechas del teclado o deslizando en el móvil.
- Para cada imagen: **descargar** a tamaño completo y **copiar** su URL, su código Markdown o su `<img>` HTML.
- Los filtros y la imagen abierta van en la URL, así que puedes compartir un enlace directo a una vista.
- Español e inglés y tema claro/oscuro (se recuerdan entre visitas).

## Cómo añadir imágenes

La galería **se actualiza sola**: no hay que tocar el `index.html`.

1. Sube las imágenes a `img/<categoría>/`, desde la web de GitHub (*Add file → Upload files*) o con `git push`.
   - Valen JPG, PNG, WebP, GIF o AVIF, con cualquier nombre: espacios, tildes o mayúsculas.
   - Si quieres una categoría nueva, basta con crear su carpeta. Lo que dejes suelto en `img/` aparece como «Sin clasificar».
2. En cada push, la Action [`pages.yml`](.github/workflows/pages.yml) ejecuta [`tools/ghostart.py`](tools/ghostart.py), que:
   - convierte a WebP (calidad 82, 2560 px como máximo) lo que no lo sea y limpia el nombre;
   - genera la miniatura de 640 px en `thumbs/`;
   - regenera `manifest.json` (la lista que lee la galería) y publica la web.
3. En uno o dos minutos la imagen aparece en la galería.

> [!TIP]
> Subir directamente en WebP ahorra espacio en el historial del repo: el JPG o PNG original se borra tras convertirlo, pero queda en el historial de git.

## Categorías

| Carpeta | Contenido |
|---|---|
| `carrera-ctf` | Carrera, certificaciones, CTF, laboratorios y cursos |
| `cloud-devsecops` | AWS, Azure, GCP, Kubernetes, contenedores y cadena CI/CD |
| `cripto` | Criptografía, PKI, esteganografía y blockchain |
| `defensa-soc` | SIEM, detección, threat hunting y MITRE |
| `forense-dfir` | Forense y respuesta a incidentes |
| `fraude-ingenieria-social` | Phishing, vishing, deepfakes y estafas |
| `gestion-normativa` | NIS2, DORA, RGPD, ENS, ISO 27001, riesgo y programas |
| `ia-llm` | IA, LLM y agentes |
| `identidad-ad` | Active Directory, Entra ID, MFA, passkeys y PAM |
| `inteligencia-amenazas` | CTI, APT y cadena de suministro |
| `malware-reversing` | Malware, ransomware y reversing |
| `movil` | Android e iOS |
| `ofensiva-redteam` | Pentesting, post-explotación y Red Team |
| `osint` | OSINT y reconocimiento |
| `ot-ics` | Seguridad industrial |
| `radio-hardware-iot` | SDR, RFID/NFC, hardware hacking e IoT |
| `redes-wifi` | Redes, WiFi, DNS, VPN y correo |
| `sistemas-hardening` | Linux, Windows, macOS y bastionado |
| `web-appsec` | Vulnerabilidades web, APIs y herramientas AppSec |

## Estructura

```
index.html            la galería
assets/               estilos, script y logo
img/<categoría>/      imágenes a tamaño completo (WebP)
thumbs/<categoría>/   miniaturas (las genera la Action)
manifest.json         índice de imágenes (lo genera la Action)
tools/ghostart.py     conversión, miniaturas y manifiesto
```

Para probar en local: `python tools/ghostart.py`, luego `python -m http.server` y abrir `http://localhost:8000`.

## Licencia

- **Código** (`index.html`, `assets/`, `tools/`, `.github/`): [MIT](LICENSE).
- **Imágenes** (`img/` y `thumbs/`): [CC BY 4.0](LICENSE-IMAGES.md). Puedes usarlas, modificarlas y redistribuirlas, también con fines comerciales, siempre que cites la autoría:

  > Ilustración: [Un Fantasma en el Sistema](https://www.unfantasmaenelsistema.com) (CC BY 4.0)
