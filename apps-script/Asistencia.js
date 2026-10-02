// ════════════════════════════════════════════════════════════════
// LA CULPA — Apps Script v2 (COPIA DE REFERENCIA REDACTADA)
//
// ⚠️  Espejo de solo lectura del proyecto real de Google Apps Script.
//     Los secretos fueron reemplazados por placeholders; el valor real
//     vive ÚNICAMENTE en el proyecto vivo (script.google.com).
//
//     NO ejecutar `clasp push` con este archivo. La fuente de verdad
//     para deployar es el proyecto en script.google.com.
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// LA CULPA — Apps Script v2 (reacciones muro, encuestas, foto portada)
// ════════════════════════════════════════════════════════════════

const SA_PRIVATE_KEY  = "<REDACTED — el valor real vive en el proyecto vivo; NO HACER PUSH de este archivo>";
const SA_CLIENT_EMAIL = "<REDACTED — el valor real vive en el proyecto vivo>";
const FCM_PROJECT_ID  = "la-culpa";
const SHEET_ID        = '161VeGFs7DuavtXRwt0QRgnoObuD-QeNDnfXnJvlESZE';
const DRIVE_FOTOS_ROOT = '1lfoZSb3v4paxyyVGeJ9O_USbsdel_ldV';
const ADMIN_EMAIL      = 'tomascimmino@gmail.com';

function resp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function ok(data)  { return resp(Object.assign({ success: true }, data)); }
function err(msg)  { return resp({ success: false, error: msg }); }

function normId(id) { 
  return String(id ?? '').trim().replace(/^'+/, ''); 
}
function getIdFila(row) { return normId(row[8]) || normId(row[0]); }

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.openById(SHEET_ID);

    // ── CREAR JUNTADA ────────────────────────────────────────
    if (data.accion === 'crear_juntada') {
      const sheet = ss.getSheetByName('Hoja 1');
      const colA  = sheet.getRange('A:A').getValues();
      let ultima  = 1;
      for (let i = 0; i < colA.length; i++) { if (colA[i][0] !== '') ultima = i + 1; }
      const fila = ultima + 1;
      sheet.getRange(fila, 1).setValue(data.fecha);
      sheet.getRange(fila, 2).setValue(data.host);
      sheet.getRange(fila, 19).setValue(data.descripcion);
      sheet.getRange(fila, 20).setValue(data.categoria || '');
      sheet.getRange(fila, 24).setValue(data.hora || '');
      sheet.getRange(fila, 3, 1, 15).clearDataValidations();
      enviarNotificacionNuevaJuntada(data.fecha, data.host, data.descripcion);
      try {
        const driveId = crearCarpetaJuntada(data.fecha, data.descripcion);
        if (driveId) sheet.getRange(fila, 23).setValue(driveId);
      } catch(driveErr) { Logger.log('Error Drive: ' + driveErr); }
      return ok({ mensaje: '¡Juntada creada!', fila });
    }

    // ── EDITAR JUNTADA ───────────────────────────────────────
    if (data.accion === 'editar_juntada') {
      const sheet = ss.getSheetByName('Hoja 1');
      sheet.getRange(data.fila, 1).setValue(data.fecha);
      sheet.getRange(data.fila, 2).setValue(data.host);
      sheet.getRange(data.fila, 19).setValue(data.descripcion);
      sheet.getRange(data.fila, 20).setValue(data.categoria || '');
      sheet.getRange(data.fila, 24).setValue(data.hora || '');
      return ok({ mensaje: '¡Juntada actualizada!' });
    }

    // ── ELIMINAR JUNTADA ─────────────────────────────────────
    if (data.accion === 'eliminar_juntada') {
      ss.getSheetByName('Hoja 1').deleteRow(data.fila);
      return ok({ mensaje: '¡Juntada eliminada!' });
    }

    // ── CARGAR FOTO DE PORTADA + CONFIRMAR JUNTADA ───────────
    // Columna V = col 22 (0-indexed) = col 22 en getRange (1-indexed)
    // También marca la juntada como "confirmada" (col W = col 23)
    if (data.accion === 'cargar_foto_juntada') {
      const sheet = ss.getSheetByName('Hoja 1');
      // Col 22 (1-indexed) = "Foto Juntada"
      sheet.getRange(data.fila, 22).setValue(data.foto);
      // Marcar como confirmada en col 25 (Y) si no tiene ya
      const rowData = sheet.getRange(data.fila, 1, 1, 25).getValues()[0];
      if (!rowData[24]) { // col Y vacía = no confirmada aún
        sheet.getRange(data.fila, 25).setValue('CONFIRMADA');
      }
      return ok({ mensaje: 'Foto cargada y juntada confirmada' });
    }

        // ── CONFIRMAR JUNTADA CON FOTO (desde el front) ───────────
        // ── CONFIRMAR JUNTADA CON FOTO ───────────────────────────
    if (data.accion === 'confirmar_juntada_con_foto') {
      const sheet = ss.getSheetByName('Hoja 1');
      const fila = data.fila;
      const fotoUrl = data.fotoUrl;
      
      // Solo guardar la foto en columna 22 (V)
      sheet.getRange(fila, 22).setValue(fotoUrl);
      
      return ok({ 
        success: true, 
        mensaje: '✅ Juntada confirmada con foto'
      });
    }

    // ── GUARDAR TOKEN FCM ────────────────────────────────────
    if (data.accion === 'guardar_token') {
      guardarToken(data.email, data.token);
      return ok({});
    }

    // ── GUARDAR BIO ──────────────────────────────────────────
    if (data.accion === 'guardar_bio') {
      const sheet = ss.getSheetByName('CULPOSOS');
      const rows  = sheet.getDataRange().getValues();
      const hdr   = rows[0];
      const emailCol = hdr.indexOf('Email');
      const bioCol   = hdr.indexOf('Bio');
      if (bioCol === -1) return err('Columna Bio no existe en CULPOSOS');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][emailCol]).toLowerCase() === String(data.email).toLowerCase()) {
          sheet.getRange(i + 1, bioCol + 1).setValue(data.bio);
          return ok({});
        }
      }
      return err('Usuario no encontrado');
    }

    // ════════════════════════════════════════════════════════
    // MURO — sheet COMENTARIOS
    // Columnas: [0]ID | [1]Destinatario | [2]Autor | [3]Texto | [4]Fecha
    //           [5]Likes | [6]Coronas | [7]Tipo | [8]ID2
    //           [9]Opciones (encuestas) | [10]Votos (encuestas)
    // ════════════════════════════════════════════════════════

    // ── CREAR POST EN EL MURO ─────────────────────────────
    if (data.accion === 'crear_post') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const id    = 'post_' + Date.now();
      const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([id, 'MURO', data.autor, data.texto, fecha, '', '', 'post', id, '', '']);
      return ok({ id });
    }

    // ── CREAR ENCUESTA EN EL MURO ────────────────────────
    if (data.accion === 'crear_encuesta') {
      if (!data.pregunta || !data.opciones || data.opciones.length < 2) return err('Faltan datos');
      const sheet = ss.getSheetByName('COMENTARIOS');
      const id    = 'enc_' + Date.now();
      const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
      const opcionesStr = data.opciones.join('|');
      sheet.appendRow([id, 'MURO', data.autor, data.pregunta, fecha, '', '', 'encuesta', id, opcionesStr, '']);
      return ok({ id });
    }

    // ── VOTAR EN ENCUESTA ────────────────────────────────
    if (data.accion === 'votar_encuesta') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const rows  = sheet.getDataRange().getValues();
      const idBuscado = normId(data.id);
      for (let i = 1; i < rows.length; i++) {
        if (getIdFila(rows[i]) !== idBuscado) continue;
        if (String(rows[i][7]) !== 'encuesta') continue;
        let votosStr = String(rows[i][10] || '');
        let votos = votosStr ? votosStr.split(',').filter(Boolean) : [];
        votos = votos.filter(v => v.split(':')[0] !== data.email);
        votos.push(data.email + ':' + data.opcionIdx);
        sheet.getRange(i + 1, 11).setValue(votos.join(','));
        return ok({ votos: votos.join(',') });
      }
      return err('Encuesta no encontrada');
    }

    // ── LIKEAR COMENTARIO (legacy) → REDIRIGE A reaccionar_comentario ──
    if (data.accion === 'likear_comentario') {
      // Compatibilidad histórica: redirigir al sistema unificado
      data.accion = 'reaccionar_comentario';
      data.tipo = 'like'; // likear_comentario siempre es 'like'
      // Continúa al bloque reaccionar_comentario abajo
    }

    // ── REACCIONAR (like/corona) A POST, COMENTARIO O INTERACCIÓN JUNTADA ──
    // Unificado: sirve para posts, comentarios del muro, comentarios de perfil y juntadas
 if (data.accion === 'reaccionar_post') {
  const sheet = ss.getSheetByName('COMENTARIOS');
  const rows  = sheet.getDataRange().getValues();
  const idBuscado = normId(data.id);

  const dataRows = rows.slice(1);
  const index = dataRows.findIndex(row => normId(getIdFila(row)) === idBuscado);

  if (index === -1) return err('Fila no encontrada: ' + data.id);

  const row = dataRows[index];
  const col = data.tipo === 'like' ? 5 : 6; // 5=Likes, 6=Coronas
  let arr = row[col] ? String(row[col]).split(',').filter(Boolean) : [];
  const idx = arr.indexOf(data.email);

  if (idx > -1) arr.splice(idx, 1);
  else arr.push(data.email);

  sheet.getRange(index + 2, col + 1).setValue(arr.join(','));
  return ok({});
}

    // ── REACCIONAR A COMENTARIO (alias de reaccionar_post, mantener compatibilidad) ──
   if (data.accion === 'reaccionar_comentario') {
  const sheet = ss.getSheetByName('COMENTARIOS');
  const rows  = sheet.getDataRange().getValues();
  const idBuscado = normId(data.id);

  const dataRows = rows.slice(1);
  const index = dataRows.findIndex(row => normId(getIdFila(row)) === idBuscado);

  if (index === -1) return err('Comentario no encontrado: ' + data.id);

  const row = dataRows[index];
  const col = data.tipo === 'like' ? 5 : 6;
  let arr = row[col] ? String(row[col]).split(',').filter(Boolean) : [];
  const idx = arr.indexOf(data.email);

  if (idx > -1) arr.splice(idx, 1);
  else arr.push(data.email);

  sheet.getRange(index + 2, col + 1).setValue(arr.join(','));
  return ok({});
}

    // ── COMENTAR EN POST DEL MURO O EN JUNTADA ───────────
    if (data.accion === 'comentar_post') {
      if (!data.postId) return err('postId vacío');
      const sheet = ss.getSheetByName('COMENTARIOS');
      const id    = 'com_' + Date.now();
      const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([id, String(data.postId), data.autor, data.texto, fecha, '', '', 'comentario', id, '', '']);

      try {
        const culposos  = ss.getSheetByName('CULPOSOS').getDataRange().getValues();
        const cH        = culposos[0];
        const emailCol  = cH.indexOf('Email');
        const nombreCol = cH.indexOf('Nombre');
        const tokenCol  = cH.indexOf('FCMToken');
        if (emailCol === -1 || nombreCol === -1) throw new Error('Columnas CULPOSOS no encontradas');

        const autorRow    = culposos.slice(1).find(r => r[emailCol] && String(r[emailCol]).toLowerCase() === String(data.autor).toLowerCase());
        const autorNombre = autorRow ? autorRow[nombreCol] : data.autor;

        const esPerfilComentario = culposos.slice(1).some(r => String(r[nombreCol]) === String(data.postId));
        if (esPerfilComentario) {
          const destRow = culposos.slice(1).find(r => String(r[nombreCol]) === String(data.postId));
          if (destRow && destRow[emailCol] &&
              String(destRow[emailCol]).toLowerCase() !== String(data.autor).toLowerCase() &&
              destRow[tokenCol]) {
            enviarNotificacion(destRow[tokenCol], '💬 Nuevo comentario en tu perfil', `${autorNombre}: "${String(data.texto).slice(0,80)}"`);
          }
        }

        const comRows    = sheet.getDataRange().getValues();
        const postIdNorm = normId(String(data.postId));
        const postRow    = comRows.slice(1).find(r => getIdFila(r) === postIdNorm && (r[7] === 'post' || r[7] === 'encuesta'));
        if (postRow && postRow[2] && String(postRow[2]).toLowerCase() !== String(data.autor).toLowerCase()) {
          const destRow = culposos.slice(1).find(r => r[emailCol] && String(r[emailCol]).toLowerCase() === String(postRow[2]).toLowerCase());
          if (destRow && destRow[tokenCol]) {
            enviarNotificacion(destRow[tokenCol], '💬 Respondieron tu estado', `${autorNombre}: "${String(data.texto).slice(0,80)}"`);
          }
        }

        if (String(data.postId).startsWith('juntada_')) {
          const yaComentaron = [...new Set(
            comRows.slice(1)
              .filter(r => String(r[1]) === String(data.postId) && r[7] === 'comentario' &&
                           r[2] && String(r[2]).toLowerCase() !== String(data.autor).toLowerCase())
              .map(r => r[2])
          )];
          yaComentaron.forEach(emailOtro => {
            const destRow = culposos.slice(1).find(r => r[emailCol] && String(r[emailCol]).toLowerCase() === emailOtro.toLowerCase());
            if (destRow && destRow[tokenCol]) {
              enviarNotificacion(destRow[tokenCol], '💬 Nuevo comentario en una juntada', `${autorNombre}: "${String(data.texto).slice(0,80)}"`);
            }
          });
        }
      } catch(notifErr) { Logger.log('Error notif comentario: ' + notifErr); }

      return ok({ id });
    }

    // ── COMENTAR EN PERFIL (legacy) ───────────────────────
    if (data.accion === 'comentar') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const id    = 'com_' + Date.now();
      const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([id, data.destinatario, data.autor, data.texto, fecha, '', '', 'comentario', id, '', '']);
      return ok({ mensaje: 'Comentario guardado' });
    }

    
    // ── ELIMINAR POST ────────────────────────────────────
    if (data.accion === 'eliminar_post') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const rows  = sheet.getDataRange().getValues();
      const idBuscado = normId(data.id);
      for (let i = rows.length - 1; i >= 1; i--) {
        const esElPost     = getIdFila(rows[i]) === idBuscado;
        const esComentario = normId(rows[i][1]) === idBuscado || normId(rows[i][8]) === idBuscado;
        if (esElPost) {
          if (rows[i][2].toLowerCase() !== data.email.toLowerCase() && data.email.toLowerCase() !== ADMIN_EMAIL) return err('Sin permisos');
          sheet.deleteRow(i + 1);
        } else if (esComentario) {
          sheet.deleteRow(i + 1);
        }
      }
      return ok({});
    }

    // ── ELIMINAR COMENTARIO ──────────────────────────────
    if (data.accion === 'eliminar_comentario') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const rows  = sheet.getDataRange().getValues();
      const idBuscado = normId(data.id);
      for (let i = 1; i < rows.length; i++) {
        if (normId(rows[i][0]) !== idBuscado && getIdFila(rows[i]) !== idBuscado) continue;
        const esAutor = String(rows[i][2]).toLowerCase() === String(data.email).toLowerCase();
        const esAdmin = String(data.email).toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (!esAutor && !esAdmin) return err('No autorizado');
        sheet.deleteRow(i + 1);
        return ok({ mensaje: 'Comentario eliminado' });
      }
      return err('Comentario no encontrado');
    }

    // ── PRIMERA REACCIÓN A JUNTADA ───────────────────────
    if (data.accion === 'crear_interaccion_juntada') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const id    = data.juntadaId + '_reac';
      const rows  = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (getIdFila(rows[i]) === id) return ok({});
      }
      const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([id, data.juntadaId, '', '', fecha, '', '', 'juntada', id, '', '']);
      return ok({});
    }

    // ── GET MURO (JSON limpio) ────────────────────────────
    if (data.accion === 'get_muro') {
      const sheet = ss.getSheetByName('COMENTARIOS');
      const rows  = sheet.getDataRange().getValues();
      const result = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const id  = getIdFila(row);
        if (!id) continue;
        result.push({
          ID:           id,
          Destinatario: String(row[1] || ''),
          Autor:        String(row[2] || ''),
          Texto:        String(row[3] || ''),
          Fecha:        String(row[4] || ''),
          Likes:        String(row[5] || ''),
          Coronas:      String(row[6] || ''),
          Tipo:         String(row[7] || ''),
          Opciones:     String(row[9] || ''),
          Votos:        String(row[10] || '')
        });
      }
      return ok({ rows: result });
    }

    // ── REGISTRAR REPRODUCCIÓN ───────────────────────────────
    if (data.accion === 'registrar_reproduccion') {
      const sheet = ss.getSheetByName('REPRODUCCIONES');
      if (!sheet) return err('Hoja REPRODUCCIONES no existe');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(data.cancion).trim()) {
          const actual = parseInt(rows[i][1]) || 0;
          sheet.getRange(i + 1, 2).setValue(actual + 1);
          sheet.getRange(i + 1, 3).setValue(Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm'));
          return ok({ reproducciones: actual + 1 });
        }
      }
      sheet.appendRow([data.cancion, 1, Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm')]);
      return ok({ reproducciones: 1 });
    }

    // ── GET REPRODUCCIONES ───────────────────────────────────
    if (data.accion === 'get_reproducciones') {
      const sheet = ss.getSheetByName('REPRODUCCIONES');
      if (!sheet) return ok({ total: 0, canciones: [] });
      const rows = sheet.getDataRange().getValues().slice(1);
      const canciones = rows.map(r => ({ cancion: r[0], reproducciones: parseInt(r[1]) || 0 }));
      const total = canciones.reduce((s, c) => s + c.reproducciones, 0);
      return ok({ total, canciones });
    }

    // ── PROPONER LEY ─────────────────────────────────────────
    if (data.accion === 'proponer_ley') {
      const sheet = ss.getSheetByName('LEYES');
      if (!sheet) return err('Hoja LEYES no existe');
      const rows = sheet.getDataRange().getValues();
      const propuestasUsuario = rows.slice(1).filter(r => String(r[0]).trim() === String(data.nombre).trim());
      if (propuestasUsuario.length >= 3) return err('Ya alcanzaste el máximo de 3 propuestas, culposo.');
      const timestamp = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([data.nombre, data.titulo, data.descripcion, timestamp]);
      return ok({ mensaje: '¡Ley propuesta!' });
    }

    if (data.accion === 'guardar_wordle')       return resp(guardarWordle(data));
    if (data.accion === 'get_wordle_dia')        return resp(getWordleDia(data));
    if (data.accion === 'get_wordle_historial')  return resp(getWordleHistorial(data));

    // ── GET LEYES ────────────────────────────────────────────
    if (data.accion === 'get_leyes') {
      const sheet = ss.getSheetByName('LEYES');
      if (!sheet) return ok({ leyes: [] });
      const rows = sheet.getDataRange().getValues();
      const leyes = rows.slice(1).filter(r => r[0] && r[1]).map(r => ({
        nombre:      String(r[0] || ''),
        titulo:      String(r[1] || ''),
        descripcion: String(r[2] || ''),
        timestamp:   r[3] ? Utilities.formatDate(new Date(r[3]), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm') : ''
      }));
      return ok({ leyes });
    }

    // ── GET CONCLAVE ─────────────────────────────────────────
    if (data.accion === 'get_conclave') {
      const sheet = ss.getSheetByName('LEYES');
      if (!sheet) return ok({ leyes: [], leyActiva: 0, iniciado: false });
      const props     = PropertiesService.getScriptProperties();
      const iniciado  = props.getProperty('conclave_iniciado') === 'true';
      const leyActiva = parseInt(props.getProperty('conclave_ley_activa') || '0');
      const rows      = sheet.getDataRange().getValues();
      const VOTANTES  = ['Toto','Caamaño','Rama','Zabala','Santi','Mateo','Tirri','Toti','Cata','Lola','Sami','Leila','Juli','Manu','Matu'];
      const leyes = rows.slice(1).filter(r => r[0] && r[1]).map((r, i) => {
        const votos = {};
        VOTANTES.forEach((n, vi) => { votos[n] = r[4 + vi] ? parseInt(r[4 + vi]) : null; });
        return {
          index: i, nombre: String(r[0] || ''), titulo: String(r[1] || ''), descripcion: String(r[2] || ''),
          votos, favor: parseInt(r[19]) || 0, contra: parseInt(r[20]) || 0, abstenciones: parseInt(r[21]) || 0,
        };
      });
      return ok({ leyes, leyActiva, iniciado });
    }

    // ── INICIAR CONCLAVE ─────────────────────────────────────
    if (data.accion === 'iniciar_conclave') {
      if (data.email !== ADMIN_EMAIL && data.email !== 'agustin.zabala.731@gmail.com') {
        const cSheet = ss.getSheetByName('CULPOSOS');
        const cRows  = cSheet.getDataRange().getValues();
        const cH     = cRows[0];
        const emailCol  = cH.indexOf('Email');
        const nombreCol = cH.indexOf('Nombre');
        const esZabala  = cRows.slice(1).some(r =>
          String(r[emailCol]).toLowerCase() === String(data.email).toLowerCase() &&
          String(r[nombreCol]) === 'Zabala'
        );
        if (!esZabala) return err('Solo Zabala puede iniciar el Cónclave');
      }
      const props = PropertiesService.getScriptProperties();
      props.setProperty('conclave_iniciado', 'true');
      props.setProperty('conclave_ley_activa', '0');
      return ok({ mensaje: '¡Cónclave iniciado!' });
    }

    // ── VOTAR LEY ────────────────────────────────────────────
    if (data.accion === 'votar_ley') {
      const sheet    = ss.getSheetByName('LEYES');
      if (!sheet) return err('Hoja LEYES no existe');
      const VOTANTES = ['Toto','Caamaño','Rama','Zabala','Santi','Mateo','Tirri','Toti','Cata','Lola','Sami','Leila','Juli','Manu','Matu'];
      const colVotante = VOTANTES.indexOf(data.nombre);
      if (colVotante === -1) return err('Votante no reconocido: ' + data.nombre);
      if (![1,2,3].includes(parseInt(data.voto))) return err('Voto inválido');
      const fila = parseInt(data.leyIndex) + 2;
      sheet.getRange(fila, colVotante + 5).setValue(parseInt(data.voto));
      const rows     = sheet.getDataRange().getValues();
      const filaData = rows[fila - 1];
      let favor = 0, contra = 0, abst = 0;
      VOTANTES.forEach((n, vi) => {
        const v = parseInt(filaData[4 + vi]);
        if (v === 1) favor++; else if (v === 2) contra++; else if (v === 3) abst++;
      });
      sheet.getRange(fila, 20).setValue(favor);
      sheet.getRange(fila, 21).setValue(contra);
      sheet.getRange(fila, 22).setValue(abst);
      return ok({ favor, contra, abstenciones: abst, totalVotos: favor + contra + abst });
    }

    // ── AVANZAR LEY ──────────────────────────────────────────
    if (data.accion === 'avanzar_ley') {
      const cSheet = ss.getSheetByName('CULPOSOS');
      const cRows  = cSheet.getDataRange().getValues();
      const cH     = cRows[0];
      const emailCol  = cH.indexOf('Email');
      const nombreCol = cH.indexOf('Nombre');
      const esZabala  = cRows.slice(1).some(r =>
        String(r[emailCol]).toLowerCase() === String(data.email).toLowerCase() &&
        String(r[nombreCol]) === 'Zabala'
      );
      if (!esZabala && data.email !== ADMIN_EMAIL) return err('Solo Zabala puede avanzar');
      const props  = PropertiesService.getScriptProperties();
      const actual = parseInt(props.getProperty('conclave_ley_activa') || '0');
      props.setProperty('conclave_ley_activa', String(actual + 1));
      return ok({ leyActiva: actual + 1 });
    }

    // ── RESET CONCLAVE ───────────────────────────────────────
    if (data.accion === 'reset_conclave') {
      if (data.email !== ADMIN_EMAIL) return err('Solo el admin puede resetear');
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty('conclave_iniciado');
      props.deleteProperty('conclave_ley_activa');
      const sheet = ss.getSheetByName('LEYES');
      if (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) sheet.getRange(2, 5, lastRow - 1, 18).clearContent();
      }
      return ok({ mensaje: 'Cónclave reseteado' });
    }

    // ════════════════════════════════════════════════════════
    // CONFIRMAR ASISTENCIA (fallback)
    // ════════════════════════════════════════════════════════
    const sheetJuntadas = ss.getSheetByName('Hoja 1');
    const sheetCulposos = ss.getSheetByName('CULPOSOS');
    const culpososData  = sheetCulposos.getDataRange().getValues();

    let nombreUsuario = null;
    for (let i = 1; i < culpososData.length; i++) {
      if (culpososData[i][1] && culpososData[i][1].toLowerCase() === data.email.toLowerCase()) {
        nombreUsuario = culpososData[i][0]; break;
      }
    }
    if (!nombreUsuario) return err('Usuario no encontrado');

    const headers = sheetJuntadas.getRange(1, 1, 1, sheetJuntadas.getLastColumn()).getValues()[0];
    let columna = -1;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] === nombreUsuario) { columna = i + 1; break; }
    }
    if (columna === -1) return err('Columna no encontrada: ' + nombreUsuario);
    const valorFinal = data.valor !== undefined ? data.valor : (data.asistira ? 1 : 2);
    sheetJuntadas.getRange(data.fila, columna).setValue(valorFinal);

    try {
      const filaData = sheetJuntadas.getRange(data.fila, 1, 1, 25).getValues()[0];
      const driveIdExistente = filaData[22];
      if (!driveIdExistente) {
        const headersRow = sheetJuntadas.getRange(1, 1, 1, sheetJuntadas.getLastColumn()).getValues()[0];
        const culpososOriginales = ['Mateo','Rama','Tirri','Toti','Toto','Caamaño','Zabala','Santi'];
        let conteo = 0;
        culpososOriginales.forEach(nombre => {
          const col = headersRow.indexOf(nombre);
          if (col !== -1 && (filaData[col] === true || filaData[col] === 1 || filaData[col] === '1')) conteo++;
        });
        if (conteo >= 4) {
          const fecha = filaData[0] instanceof Date
            ? `${filaData[0].getDate()}/${filaData[0].getMonth()+1}/${filaData[0].getFullYear()}`
            : String(filaData[0]);
          const descripcion = filaData[18] || '';
          const driveId = crearCarpetaJuntada(fecha, descripcion);
          if (driveId) sheetJuntadas.getRange(data.fila, 23).setValue(driveId);
          const yaNotifQuorum = filaData[24];
          if (!yaNotifQuorum) {
            sheetJuntadas.getRange(data.fila, 25).setValue('QUORUM_NOTIF_SENT');
            enviarNotificacionQuorum(fecha, descripcion, filaData[1] || '');
          }
        }
      }
    } catch(driveErr) { Logger.log('Error Drive quorum: ' + driveErr); }

    return ok({ mensaje: 'Confirmación guardada' });

  } catch(globalErr) {
    return resp({ success: false, error: globalErr.toString() });
  }
}

// ════════════════════════════════════════════════════════════════
// TOKENS FCM
// ════════════════════════════════════════════════════════════════
function guardarToken(email, token) {
  const ss  = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('TOKENS');
  if (!sheet) {
    sheet = ss.insertSheet('TOKENS');
    sheet.getRange(1,1,1,3).setValues([['Email','Token','Fecha']]);
  }
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === email) { sheet.getRange(i+1,2).setValue(token); sheet.getRange(i+1,3).setValue(new Date()); return; }
  }
  sheet.appendRow([email, token, new Date()]);
}

// ════════════════════════════════════════════════════════════════
// FCM
// ════════════════════════════════════════════════════════════════
function getFcmAccessToken() {
  const now     = Math.floor(Date.now() / 1000);
  const header  = Utilities.base64EncodeWebSafe(JSON.stringify({ alg:'RS256', typ:'JWT' }));
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: SA_CLIENT_EMAIL, sub: SA_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }));
  const signInput = header + '.' + payload;
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(signInput, SA_PRIVATE_KEY));
  const jwt = signInput + '.' + signature;
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', contentType: 'application/x-www-form-urlencoded',
    payload: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText()).access_token;
}

function enviarNotificacion(token, title, body) {
  try {
    const accessToken = getFcmAccessToken();
    UrlFetchApp.fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify({ message: { token, notification: { title, body },
        webpush: { notification: { icon: 'https://i.imgur.com/czObXpX.png' },
          fcm_options: { link: 'https://tomascimmino.github.io/la-culpa-app/' } } } }),
      muteHttpExceptions: true
    });
  } catch(e) { Logger.log('Error enviarNotificacion: ' + e); }
}

function enviarNotificacionNuevaJuntada(fecha, host, descripcion) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TOKENS'); if (!sheet) return;
  const tokens = sheet.getDataRange().getValues().slice(1).map(r=>r[1]).filter(Boolean);
  tokens.forEach(t => enviarNotificacion(t, '🎉 Nueva Juntada — LA CULPA', `${descripcion} · ${fecha} · Host: ${host}`));
}

function enviarNotificacionQuorum(fecha, descripcion, host) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TOKENS'); if (!sheet) return;
  const tokens = sheet.getDataRange().getValues().slice(1).map(r=>r[1]).filter(Boolean);
  tokens.forEach(t => enviarNotificacion(t, '👑 ¡HAY QUORUM! — LA CULPA', `${descripcion} · ${fecha} · No duermas en confirmar 👀`));
}

// ════════════════════════════════════════════════════════════════
// DRIVE
// ════════════════════════════════════════════════════════════════
const NOMBRES_MESES_DRIVE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function crearCarpetaJuntada(fecha, descripcion) {
  const partes = fecha.split('/'); if (partes.length !== 3) return null;
  const d = parseInt(partes[0]), m = parseInt(partes[1]) - 1, y = partes[2];
  const root = DriveApp.getFolderById(DRIVE_FOTOS_ROOT);
  const nombreMes = NOMBRES_MESES_DRIVE[m];
  const itMes = root.getFoldersByName(nombreMes);
  const carpetaMes = itMes.hasNext() ? itMes.next() : root.createFolder(nombreMes);
  carpetaMes.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  const carpetaJuntada = carpetaMes.createFolder(`${d}-${m+1}-${y} ${descripcion}`.trim());
  carpetaJuntada.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  return carpetaJuntada.getId();
}

// ════════════════════════════════════════════════════════════════
// TRIGGERS
// ════════════════════════════════════════════════════════════════
function verificarQuorumYNotificar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jSheet = ss.getSheetByName('Hoja 1'), cSheet = ss.getSheetByName('CULPOSOS');
  const jRows = jSheet.getDataRange().getValues(), cRows = cSheet.getDataRange().getValues();
  const jHeaders = jRows[0], cHeaders = cRows[0];
  const tokenCol = cHeaders.indexOf('FCMToken');
  const REYES = ['Toto','Caamaño','Rama','Zabala','Santi','Mateo','Tirri','Toti'];
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  jRows.slice(1).forEach((j, idx) => {
    const fila = idx + 2;
    const fechaStr = j[jHeaders.indexOf('Fecha')]; if (!fechaStr) return;
    const p = String(fechaStr).split('/'); if (p.length !== 3) return;
    const fechaJ = new Date(p[2], p[1]-1, p[0]); if (fechaJ < hoy) return;
    let reyesConf = 0;
    REYES.forEach(n => { const col = jHeaders.indexOf(n); if (col !== -1 && (j[col]==='TRUE'||j[col]==='✓'||j[col]===1||j[col]==='1')) reyesConf++; });
    if (reyesConf < 4) return;
    const propKey = 'quorum_fila_' + fila;
    if (PropertiesService.getScriptProperties().getProperty(propKey)) return;
    const descCol = jHeaders.indexOf('Descripción') !== -1 ? jHeaders.indexOf('Descripción') : jHeaders.indexOf('Descripcion');
    const desc = j[descCol]||'Juntada', fecha = j[jHeaders.indexOf('Fecha')]||'', host = j[jHeaders.indexOf('Host')]||'';
    cRows.slice(1).map(r=>r[tokenCol]).filter(Boolean).forEach(t => enviarNotificacion(t, '👑 ¡HAY QUORUM!', `${desc} · ${fecha} · 🏠 ${host}`));
    PropertiesService.getScriptProperties().setProperty(propKey, 'true');
  });
}

function recordatorioJuntadaHoy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jSheet = ss.getSheetByName('Hoja 1'), cSheet = ss.getSheetByName('CULPOSOS');
  const jRows = jSheet.getDataRange().getValues(), cRows = cSheet.getDataRange().getValues();
  const jHeaders = jRows[0], cHeaders = cRows[0];
  const tokenCol = cHeaders.indexOf('FCMToken');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  jRows.slice(1).forEach(j => {
    const fechaStr = j[jHeaders.indexOf('Fecha')]; if (!fechaStr) return;
    const p = String(fechaStr).split('/'); if (p.length !== 3) return;
    const fechaJ = new Date(p[2], p[1]-1, p[0]); fechaJ.setHours(0,0,0,0);
    if (fechaJ.getTime() !== hoy.getTime()) return;
    const descCol = jHeaders.indexOf('Descripción') !== -1 ? jHeaders.indexOf('Descripción') : jHeaders.indexOf('Descripcion');
    const desc = j[descCol]||'Juntada', host = j[jHeaders.indexOf('Host')]||'', hora = j[jHeaders.indexOf('Hora')]||'';
    cRows.slice(1).map(r=>r[tokenCol]).filter(Boolean).forEach(t => enviarNotificacion(t, '🎉 ¡HOY HAY JUNTADA!', `${desc}${hora?' a las '+hora:''} · 🏠 ${host}`));
  });
}

function limpiarJuntadasSinQuorum() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Hoja 1');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return;
  const data = sheet.getRange(2, 1, lastRow-1, 21).getValues();
  for (let i = data.length-1; i >= 0; i--) {
    const fechaVal = data[i][0], nCulposos = parseInt(data[i][20]) || 0;
    if (!fechaVal) continue;
    let fechaJ = fechaVal instanceof Date ? new Date(fechaVal) : (() => { const p=String(fechaVal).split('/'); return p.length===3?new Date(p[2],p[1]-1,p[0]):null; })();
    if (!fechaJ) continue;
    fechaJ.setHours(0,0,0,0);
    if (fechaJ < hoy && nCulposos < 4) sheet.deleteRow(i+2);
  }
}

function diagnostico() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('COMENTARIOS');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i <= 5; i++) {
    const row = rows[i];
    Logger.log(`Fila ${i+1}: col A="${row[0]}" col I="${row[8]}" getIdFila="${getIdFila(row)}"`);
  }
}

function arreglarCarpetasAnteriores() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Hoja 1');
  const datos = sheet.getDataRange().getValues();
  const root  = DriveApp.getFolderById(DRIVE_FOTOS_ROOT);
  const itMeses = root.getFolders();
  while (itMeses.hasNext()) {
    const carpetaMes = itMeses.next();
    carpetaMes.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    const itFechas = carpetaMes.getFolders();
    while (itFechas.hasNext()) {
      const carpetaFecha = itFechas.next();
      carpetaFecha.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
      const partesFecha = carpetaFecha.getName().split(' ')[0].split('-');
      if (partesFecha.length !== 3) continue;
      const dC=parseInt(partesFecha[0]), mC=parseInt(partesFecha[1]), yC=parseInt(partesFecha[2]);
      for (let i = 1; i < datos.length; i++) {
        const fv = datos[i][0]; if (!fv) continue;
        let dS,mS,yS;
        if (fv instanceof Date) { dS=fv.getDate(); mS=fv.getMonth()+1; yS=fv.getFullYear(); }
        else { const p=String(fv).split('/'); if(p.length!==3)continue; dS=parseInt(p[0]);mS=parseInt(p[1]);yS=parseInt(p[2]); }
        if (dS===dC && mS===mC && yS===yC && !datos[i][22]) sheet.getRange(i+1,23).setValue(carpetaFecha.getId());
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// WORDLE CULPOSO
// ════════════════════════════════════════════════════════════════
function guardarWordle(data) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('WORDLE');
    if (!sheet) return { success: false, error: 'Hoja WORDLE no existe' };
    const nombre  = String(data.nombre  || '').trim();
    const fecha   = String(data.fecha   || '').trim();
    const palabra = String(data.palabra || '').trim();
    if (!nombre || !fecha) return { success: false, error: 'Faltan datos' };
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === fecha && String(rows[i][1]).trim() === nombre)
        return { success: true, msg: 'Ya registrado' };
    }
    sheet.appendRow([fecha, nombre, Number(data.intentos)||0, Number(data.tiempo)||0, data.gano ? 'SI' : 'NO', palabra]);
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
}

function getWordleDia(data) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('WORDLE');
    if (!sheet) return { success: true, jugaste: false, resultados: [] };
    const nombre = String(data.nombre || '').trim();
    const fecha  = String(data.fecha  || '').trim();
    const rows   = sheet.getDataRange().getValues();
    let jugaste  = false;
    const resultados = [];
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() !== fecha) continue;
      const entry = {
        nombre:   String(rows[i][1]).trim(),
        intentos: Number(rows[i][2]) || 0,
        tiempo:   Number(rows[i][3]) || 0,
        gano:     rows[i][4] === 'SI',
        palabra:  String(rows[i][5] || '')
      };
      resultados.push(entry);
      if (entry.nombre === nombre) jugaste = true;
    }
    resultados.sort((a, b) => {
      if (a.gano !== b.gano) return a.gano ? -1 : 1;
      if (a.intentos !== b.intentos) return a.intentos - b.intentos;
      return a.tiempo - b.tiempo;
    });
    return { success: true, jugaste, resultados };
  } catch(e) { return { success: false, error: e.message, jugaste: false, resultados: [] }; }
}

function getWordleHistorial(data) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('WORDLE');
    if (!sheet) return { success: true, historial: [] };
    const nombre   = String(data.nombre || '').trim();
    const rows     = sheet.getDataRange().getValues();
    const historial = [];
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1]).trim() !== nombre) continue;
      historial.push({
        fecha:    String(rows[i][0]),
        intentos: Number(rows[i][2]) || 0,
        tiempo:   Number(rows[i][3]) || 0,
        gano:     rows[i][4] === 'SI',
        palabra:  String(rows[i][5] || '')
      });
    }
    historial.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { success: true, historial };
  } catch(e) { return { success: false, error: e.message, historial: [] }; }
}
