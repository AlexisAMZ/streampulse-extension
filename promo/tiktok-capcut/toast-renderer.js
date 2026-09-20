/**
 * Moteur de rendu Canvas 2D 60 FPS pour l'overlay TikTok StreamPulse.
 * Compatible protocole file:/// (sans module ES pour éviter les erreurs CORS navigateur).
 * Zéro émoji : uniquement des icônes vectorielles nettes et logos officiels.
 * Zéro mention "lien en bio" : affichage strict et épuré de l'URL du site.
 * Fond vert Chroma Key (#00FF00) sans aucun halo d'ombre.
 */

class ToastRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;

    this.streamer = options.streamer || "anyme023";
    this.url = options.url || "streampulse.fr";
    this.position = options.position || "pos-bottom";

    this.avatarImg = options.avatarImg || null;
    this.logoImg = options.logoImg || null;
    this.twitchImg = options.twitchImg || null;
    this.kickImg = options.kickImg || null;

    this.duration = 12.5;
    this.slideDuration = 2.5;
  }

  updateConfig({ streamer, url, position }) {
    if (streamer !== undefined) this.streamer = streamer;
    if (url !== undefined) this.url = url;
    if (position !== undefined) this.position = position;
  }

  draw(t) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Fond vert Chroma Key pur (#00FF00)
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, w, h);

    // 2. Position du toast
    const toastW = 980;
    const toastH = 240;
    const toastX = (w - toastW) / 2;
    let toastY = h - toastH - 520; // pos-bottom
    if (this.position === "pos-top") {
      toastY = 250;
    }

    // 3. Fond de la carte (zéro box-shadow externe pour détourahle Chroma Key parfait)
    ctx.save();
    this.roundRect(ctx, toastX, toastY, toastW, toastH, 32);
    ctx.fillStyle = "#0b0c22";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#9146ff";
    ctx.stroke();
    ctx.clip();

    // 4. Barres de progression (5 barres de 2.5s)
    const progressTrackY = toastY + 16;
    const progressTrackH = 4;
    const paddingX = 28;
    const barGap = 8;
    const totalBarsW = toastW - (paddingX * 2);
    const barW = (totalBarsW - (4 * barGap)) / 5;

    const currentSlideIndex = Math.min(4, Math.floor(t / this.slideDuration));
    const slideTime = t % this.slideDuration;

    for (let i = 0; i < 5; i++) {
      const bx = toastX + paddingX + i * (barW + barGap);

      // Track grise
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      this.roundRect(ctx, bx, progressTrackY, barW, progressTrackH, 2);
      ctx.fill();

      // Remplissage dynamique fluide
      if (i < currentSlideIndex) {
        ctx.fillStyle = "#9146ff";
        this.roundRect(ctx, bx, progressTrackY, barW, progressTrackH, 2);
        ctx.fill();
      } else if (i === currentSlideIndex) {
        const fillW = (slideTime / this.slideDuration) * barW;
        ctx.fillStyle = "#9146ff";
        this.roundRect(ctx, bx, progressTrackY, fillW, progressTrackH, 2);
        ctx.fill();
      }
    }

    // 5. Animation de transition de slide
    let opacity = 1;
    let offsetY = 0;
    const enterDuration = 0.22;
    const exitDuration = 0.18;

    if (slideTime < enterDuration) {
      const progress = slideTime / enterDuration;
      opacity = progress;
      offsetY = (1 - progress) * 16;
    } else if (slideTime > this.slideDuration - exitDuration) {
      const progress = (this.slideDuration - slideTime) / exitDuration;
      opacity = progress;
      offsetY = (1 - progress) * -12;
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(0, offsetY);

    // 6. Dessin du contenu
    this.drawSlideContent(ctx, currentSlideIndex, toastX + paddingX, toastY + 36, toastW - (paddingX * 2), toastH - 46);

    ctx.restore();
    ctx.restore();
  }

  drawSlideContent(ctx, slideIndex, x, y, width, height) {
    const slidesData = [
      {
        type: "avatar",
        isLive: true,
        eyebrow: "EN DIRECT SUR TWITCH",
        eyebrowColor: "#ff5e55",
        eyebrowBg: "rgba(255, 59, 48, 0.2)",
        eyebrowBorder: "#ff3b30",
        headline: `${this.streamer} est en live !`,
        sub: "Ne rate plus aucun stream grâce à StreamPulse"
      },
      {
        type: "lightning",
        eyebrow: "0 SECONDE DE RETARD",
        eyebrowColor: "#c4a3ff",
        eyebrowBg: "rgba(145, 70, 255, 0.18)",
        eyebrowBorder: "rgba(181, 139, 255, 0.45)",
        headline: "Alertes Lives Immédiates",
        sub: "Notifié sur PC dès la première seconde"
      },
      {
        type: "gift",
        eyebrow: "AUTO-CLAIM DROPS",
        eyebrowColor: "#c6d4a0",
        eyebrowBg: "rgba(198, 212, 160, 0.15)",
        eyebrowBorder: "rgba(198, 212, 160, 0.35)",
        headline: "Drops Twitch Automatiques",
        sub: "Récupère tes récompenses et skins sans y penser"
      },
      {
        type: "dual-platforms",
        eyebrow: "TWITCH ET KICK RÉUNIS",
        eyebrowColor: "#53fc18",
        eyebrowBg: "rgba(83, 252, 24, 0.15)",
        eyebrowBorder: "rgba(83, 252, 24, 0.35)",
        headline: "Multi-Plateformes en direct",
        sub: "Tous tes streamers favoris au même endroit"
      },
      {
        type: "logo",
        eyebrow: "EXTENSION GRATUITE",
        eyebrowColor: "#c4a3ff",
        eyebrowBg: "rgba(145, 70, 255, 0.18)",
        eyebrowBorder: "rgba(181, 139, 255, 0.45)",
        headline: "Télécharge StreamPulse",
        sub: "Disponible sur Chrome, Firefox et Edge"
      }
    ];

    const data = slidesData[slideIndex];

    // Alignement vertical parfait sur l'axe central de la carte
    const centerY = y + height / 2;

    const mediaSize = 116;
    const mediaX = x;
    const mediaY = centerY - mediaSize / 2;

    const badgeW = 220;
    const badgeH = 54;
    const badgeX = x + width - badgeW;
    const badgeY = centerY - badgeH / 2;

    const textX = mediaX + mediaSize + 26;

    // A. Média gauche (icônes vectorielles et logos)
    if (data.type === "avatar" && this.avatarImg && this.avatarImg.complete) {
      ctx.save();
      this.roundRect(ctx, mediaX, mediaY, mediaSize, mediaSize, mediaSize / 2);
      ctx.clip();
      ctx.drawImage(this.avatarImg, mediaX, mediaY, mediaSize, mediaSize);
      ctx.restore();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3.5;
      this.roundRect(ctx, mediaX, mediaY, mediaSize, mediaSize, mediaSize / 2);
      ctx.stroke();

      if (this.twitchImg && this.twitchImg.complete) {
        const badgeSize = 38;
        const bx = mediaX + mediaSize - badgeSize + 4;
        const by = mediaY + mediaSize - badgeSize + 4;
        ctx.fillStyle = "#000";
        this.roundRect(ctx, bx, by, badgeSize, badgeSize, badgeSize / 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        this.roundRect(ctx, bx, by, badgeSize, badgeSize, badgeSize / 2);
        ctx.stroke();
        ctx.drawImage(this.twitchImg, bx + 7, by + 7, badgeSize - 14, badgeSize - 14);
      }
    } else if (data.type === "lightning") {
      this.roundRect(ctx, mediaX, mediaY, mediaSize, mediaSize, 28);
      ctx.fillStyle = "rgba(145, 70, 255, 0.18)";
      ctx.fill();
      ctx.strokeStyle = "rgba(181, 139, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      this.drawLightning(ctx, mediaX + mediaSize / 2, mediaY + mediaSize / 2, 60, "#c4a3ff");
    } else if (data.type === "gift") {
      this.roundRect(ctx, mediaX, mediaY, mediaSize, mediaSize, 28);
      ctx.fillStyle = "rgba(198, 212, 160, 0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(198, 212, 160, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      this.drawGift(ctx, mediaX + mediaSize / 2, mediaY + mediaSize / 2, 56, "#c6d4a0");
    } else if (data.type === "dual-platforms") {
      this.roundRect(ctx, mediaX, mediaY, mediaSize, mediaSize, 28);
      ctx.fillStyle = "rgba(83, 252, 24, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(83, 252, 24, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (this.twitchImg && this.twitchImg.complete && this.kickImg && this.kickImg.complete) {
        ctx.drawImage(this.twitchImg, mediaX + 14, mediaY + 36, 42, 42);
        ctx.drawImage(this.kickImg, mediaX + 62, mediaY + 36, 42, 42);
      }
    } else if (data.type === "logo" && this.logoImg && this.logoImg.complete) {
      this.roundRect(ctx, mediaX, mediaY, mediaSize, mediaSize, 28);
      ctx.fillStyle = "#15173d";
      ctx.fill();
      ctx.strokeStyle = "rgba(181, 139, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.drawImage(this.logoImg, mediaX + 18, mediaY + 18, mediaSize - 36, mediaSize - 36);
    }

    // B. Textes centraux (parfaitement centrés verticalement en bloc)
    const textBlockH = 94;
    const textStartY = centerY - textBlockH / 2;

    // 1. Eyebrow pill
    ctx.font = "800 13px Unbounded, sans-serif";
    const eyebrowText = data.eyebrow;
    const textMetrics = ctx.measureText(eyebrowText);
    const hasLiveDot = !!data.isLive;
    const pillW = textMetrics.width + (hasLiveDot ? 36 : 24);
    const pillH = 26;
    const pillY = textStartY;

    this.roundRect(ctx, textX, pillY, pillW, pillH, 13);
    ctx.fillStyle = data.eyebrowBg;
    ctx.fill();
    ctx.strokeStyle = data.eyebrowBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let textOffset = 12;
    if (hasLiveDot) {
      ctx.beginPath();
      ctx.arc(textX + 14, pillY + pillH / 2, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff3b30";
      ctx.fill();
      textOffset = 26;
    }

    ctx.fillStyle = data.eyebrowColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(eyebrowText, textX + textOffset, pillY + pillH / 2);

    // 2. Titre principal
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 28px Unbounded, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(data.headline, textX, textStartY + pillH + 8);

    // 3. Sous-titre
    ctx.fillStyle = "rgba(244, 242, 247, 0.78)";
    ctx.font = "500 18px Onest, sans-serif";
    ctx.fillText(data.sub, textX, textStartY + pillH + 44);

    // C. Badge URL à droite (parfaitement centré verticalement)
    this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
    ctx.fillStyle = "rgba(145, 70, 255, 0.22)";
    ctx.fill();
    ctx.strokeStyle = "#9146ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 20px Unbounded, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.url, badgeX + badgeW / 2, badgeY + badgeH / 2);
  }

  drawLightning(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    const s = size / 50;
    ctx.beginPath();
    ctx.moveTo(3 * s, -22 * s);
    ctx.lineTo(-15 * s, 1 * s);
    ctx.lineTo(-1 * s, 1 * s);
    ctx.lineTo(-6 * s, 22 * s);
    ctx.lineTo(15 * s, -3 * s);
    ctx.lineTo(2 * s, -3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawGift(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    const s = size / 50;

    ctx.strokeRect(-18 * s, -6 * s, 36 * s, 26 * s);
    ctx.strokeRect(-21 * s, -14 * s, 42 * s, 8 * s);
    ctx.fillRect(-3 * s, -14 * s, 6 * s, 34 * s);

    ctx.beginPath();
    ctx.arc(-8 * s, -19 * s, 5 * s, 0, Math.PI * 2);
    ctx.arc(8 * s, -19 * s, 5 * s, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
}

if (typeof window !== "undefined") {
  window.ToastRenderer = ToastRenderer;
}
