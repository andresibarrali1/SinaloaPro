// VegBridge.cs — puente entre Corte 15 y VEGAS Pro 15.
//
// La API ScriptPortal.Vegas solo existe dentro de VEGAS, así que este script se ejecuta ahí y hace dos
// trabajos:
//
//   read  : un .veg -> un JSON con el montaje completo (propiedades, pistas, eventos, recortes, fundidos,
//                      velocidad, movimiento, curvas de opacidad, marcadores y regiones).
//   write : un TSV  -> un .veg, construido con la API y guardado con Project.SaveProject.
//
// Lo lanza el puente de Node (scripts/veg-bridge-server.mjs) así:
//
//   vegas150.exe /NOLOGO /SCRIPTARGS "job=C:\Temp\c15-veg-xxxx\job.txt" /SCRIPT "...\bridge\VegBridge.cs"
//
// job.txt son cuatro líneas: modo (read|write) | entrada | salida | informe
// El script escribe el informe (notas y omisiones) en la ruta indicada y, si algo falla, error.txt en la
// misma carpeta del trabajo. El puente espera la salida; no depende del código de salida de vegas150.exe,
// porque VEGAS es de instancia única y puede entregar la orden a una ventana ya abierta.
//
// El compilador CodeDom de .NET Framework que usa VEGAS 15 acepta C# 5: este archivo evita la
// interpolación de cadenas, los miembros con cuerpo de expresión, las expresiones condicionales nulas y
// LINQ a propósito, para que compile tal cual.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using ScriptPortal.Vegas;

public class EntryPoint
{
    static string directory = "";
    static readonly List<string> notes = new List<string>();
    static readonly List<string> skipped = new List<string>();
    static readonly CultureInfo invariant = CultureInfo.InvariantCulture;

    public void FromVegas(Vegas vegas)
    {
        try
        {
            string job = JobPath();
            if (String.IsNullOrEmpty(job)) { Fail("No se recibió el archivo de trabajo (job=...)."); return; }
            directory = Path.GetDirectoryName(job);
            if (String.IsNullOrEmpty(directory)) directory = Path.GetTempPath();
            string[] lines = File.ReadAllLines(job);
            if (lines.Length < 4) { Fail("El archivo de trabajo necesita cuatro líneas: modo, entrada, salida, informe."); return; }
            string mode = lines[0].Trim();
            string input = lines[1].Trim();
            string output = lines[2].Trim();
            string report = lines[3].Trim();
            if (mode == "read") Read(vegas, input, output);
            else if (mode == "write") Write(vegas, input, output);
            else { Fail("Modo desconocido: " + mode); return; }
            WriteReport(report);
        }
        catch (Exception error)
        {
            Fail(error.ToString());
        }
    }

    // El puente pasa la ruta del trabajo en /SCRIPTARGS. Se prueban las dos vías públicas del host de
    // scripts (los argumentos ya analizados y la cadena cruda) para no depender del analizador de VEGAS.
    static string JobPath()
    {
        try
        {
            ScriptArgs args = Script.Args;
            if (args != null)
            {
                string value = args.ValueOf("job");
                if (!String.IsNullOrEmpty(value)) return Clean(value);
            }
        }
        catch (Exception) { }
        string raw = Script.RawArgs;
        if (String.IsNullOrEmpty(raw)) return null;
        raw = raw.Trim().Trim('"');
        int separator = raw.IndexOf('&');
        if (separator >= 0) raw = raw.Substring(0, separator);
        if (raw.StartsWith("job:=")) raw = raw.Substring(5);
        else if (raw.StartsWith("job=")) raw = raw.Substring(4);
        return Clean(raw);
    }

    static string Clean(string value)
    {
        if (value == null) return null;
        return value.Trim().Trim('"').Trim();
    }

    static void Fail(string message)
    {
        try
        {
            string where = String.IsNullOrEmpty(directory) ? Path.GetTempPath() : directory;
            File.WriteAllText(Path.Combine(where, "error.txt"), message, new UTF8Encoding(false));
        }
        catch (Exception) { }
    }

    static void WriteReport(string report)
    {
        if (String.IsNullOrEmpty(report)) return;
        StringBuilder text = new StringBuilder();
        text.AppendLine("notes=" + notes.Count.ToString(invariant));
        text.AppendLine("skipped=" + skipped.Count.ToString(invariant));
        for (int index = 0; index < notes.Count; index++) text.AppendLine("nota: " + notes[index]);
        for (int index = 0; index < skipped.Count; index++) text.AppendLine("omitido: " + skipped[index]);
        File.WriteAllText(report, text.ToString(), new UTF8Encoding(false));
    }

    // ------------------------------------------------------------------ lectura

    static void Read(Vegas vegas, string veg, string json)
    {
        Project project = vegas.ReadProject(veg);   // lee el .veg sin tocar el proyecto abierto
        if (project == null) { Fail("VEGAS no pudo leer el proyecto: " + veg); return; }

        Json writer = new Json();
        writer.O();
        writer.K("lengthNanos").V(project.Length.Nanos);
        writer.K("width").V(project.Video.Width);
        writer.K("height").V(project.Video.Height);
        writer.K("frameRate").V(project.Video.FrameRate);
        writer.K("sampleRate").V((long)project.Audio.SampleRate);

        writer.K("tracks").A();
        foreach (Track track in project.Tracks)
        {
            writer.O();
            writer.K("name").V(track.Name);
            writer.K("type").V(track.MediaType.ToString());
            writer.K("mute").V(track.Mute);
            writer.K("solo").V(track.Solo);
            AudioTrack audio = track as AudioTrack;
            if (audio != null)
            {
                writer.K("volume").V(audio.Volume);
                writer.K("pan").V(audio.PanX);
            }
            writer.K("effects").V(DescribeEffects(track.Effects));
            writer.K("events").A();
            foreach (TrackEvent item in track.Events) WriteEvent(writer, item);
            writer.e();
            writer.E();
        }
        writer.e();

        writer.K("markers").A();
        foreach (Marker marker in project.Markers)
        {
            writer.O();
            writer.K("nanos").V(marker.Position.Nanos);
            writer.K("label").V(marker.Label);
            writer.E();
        }
        writer.e();

        writer.K("regions").A();
        foreach (Region region in project.Regions)
        {
            writer.O();
            writer.K("startNanos").V(region.Position.Nanos);
            writer.K("lengthNanos").V(region.Length.Nanos);
            writer.K("label").V(region.Label);
            writer.E();
        }
        writer.e();
        writer.C();

        File.WriteAllText(json, writer.ToString(), new UTF8Encoding(false));
        notes.Add("Montaje leído con la API de VEGAS: " + project.Tracks.Count.ToString(invariant) + " pista(s), marcadores y regiones incluidos.");
    }

    static void WriteEvent(Json writer, TrackEvent item)
    {
        writer.O();
        writer.K("startNanos").V(item.Start.Nanos);
        writer.K("lengthNanos").V(item.Length.Nanos);
        writer.K("name").V(item.Name);
        writer.K("mediaType").V(item.MediaType.ToString());
        writer.K("playbackRate").V(item.PlaybackRate);
        writer.K("mute").V(item.Mute);
        writer.K("fadeInNanos").V(item.FadeIn.Length.Nanos);
        writer.K("fadeOutNanos").V(item.FadeOut.Length.Nanos);
        writer.K("gain").V(EnvelopeValue(item, EnvelopeType.Volume, 1.0));

        writer.K("opacityPoints").A();
        Envelope fade = FindEnvelope(item, EnvelopeType.Fade);
        if (fade != null)
        {
            foreach (EnvelopePoint point in fade.Points)
            {
                writer.O();
                writer.K("nanos").V(point.X.Nanos);
                writer.K("value").V(point.Y);
                writer.E();
            }
        }
        writer.e();

        writer.K("volumePoints").A();
        Envelope volume = FindEnvelope(item, EnvelopeType.Volume);
        if (volume != null)
        {
            foreach (EnvelopePoint point in volume.Points)
            {
                writer.O();
                writer.K("nanos").V(point.X.Nanos);
                writer.K("value").V(point.Y);
                writer.E();
            }
        }
        writer.e();

        Take take = item.ActiveTake;
        if (take != null)
        {
            writer.K("mediaPath").V(take.MediaPath);
            writer.K("mediaName").V(take.Name);
            writer.K("offsetNanos").V(take.Offset.Nanos);
            writer.K("takeLengthNanos").V(take.Length.Nanos);
            writer.K("streamIndex").V((long)take.StreamIndex);
        }
        else
        {
            writer.K("mediaPath").V((string)null);
        }

        if (item.Effects.Count > 0) writer.K("effects").V(DescribeEffects(item.Effects));

        VideoEvent video = item as VideoEvent;
        if (video != null)
        {
            writer.K("motion").A();
            foreach (VideoMotionKeyframe frame in video.VideoMotion.Keyframes)
            {
                writer.O();
                writer.K("nanos").V(frame.Position.Nanos);
                writer.K("rotation").V(frame.Rotation);
                writer.K("left").V(frame.TopLeft.X);
                writer.K("top").V(frame.TopLeft.Y);
                writer.K("right").V(frame.BottomRight.X);
                writer.K("bottom").V(frame.BottomRight.Y);
                writer.K("cx").V(frame.Center.X);
                writer.K("cy").V(frame.Center.Y);
                writer.E();
            }
            writer.e();
        }
        writer.E();
    }

    static Envelope FindEnvelope(TrackEvent item, EnvelopeType type)
    {
        foreach (Envelope envelope in item.Envelopes) if (envelope.Type == type) return envelope;
        return null;
    }

    // Valor de una envolvente en el instante inicial del evento (el anterior más cercano).
    static double EnvelopeValue(TrackEvent item, EnvelopeType type, double fallback)
    {
        Envelope envelope = FindEnvelope(item, type);
        if (envelope == null) return fallback;
        double value = envelope.Neutral;
        foreach (EnvelopePoint point in envelope.Points)
        {
            if (point.X <= item.Start) value = point.Y;
        }
        return value;
    }

    static string DescribeEffects(Effects effects)
    {
        if (effects == null || effects.Count == 0) return null;
        StringBuilder text = new StringBuilder();
        foreach (Effect effect in effects)
        {
            if (text.Length > 0) text.Append(", ");
            text.Append(effect.PlugIn != null ? effect.PlugIn.UniqueID : effect.Description);
        }
        return text.ToString();
    }

    // ------------------------------------------------------------------ escritura

    static void Write(Vegas vegas, string tsv, string veg)
    {
        CultureInfo previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = invariant;
        try
        {
            Project project = vegas.CreateEmptyProject();
            List<Track> created = new List<Track>();
            string[] lines = File.ReadAllLines(tsv);
            for (int index = 0; index < lines.Length; index++)
            {
                string line = lines[index];
                if (line.Length == 0 || line[0] == '#') continue;
                string[] c = line.Split('\t');
                switch (c[0])
                {
                    case "project": ReadProjectLine(project, c); break;
                    case "track": ReadTrackLine(project, created, c); break;
                    case "event": ReadEventLine(project, created, c); break;
                    case "marker": ReadMarkerLine(project, c); break;
                    case "region": ReadRegionLine(project, c); break;
                    default: skipped.Add("Línea no reconocida: " + c[0]); break;
                }
            }
            if (project.Tracks.Count == 0) { Fail("El montaje no tiene pistas: no se generó ningún .veg."); return; }
            project.SaveProject(veg);
            notes.Add("Proyecto construido y guardado: " + project.Tracks.Count.ToString(invariant) + " pista(s) y "
                + project.Markers.Count.ToString(invariant) + " marcador(es).");
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    static void ReadProjectLine(Project project, string[] c)
    {
        if (c.Length < 5) { skipped.Add("Línea project incompleta."); return; }
        project.Video.Width = Int(c[1], project.Video.Width);
        project.Video.Height = Int(c[2], project.Video.Height);
        project.Video.FrameRate = Double(c[3], project.Video.FrameRate);
        project.Audio.SampleRate = (uint)Int(c[4], (int)project.Audio.SampleRate);
    }

    static void ReadTrackLine(Project project, List<Track> created, string[] c)
    {
        if (c.Length < 5) { skipped.Add("Línea track incompleta."); return; }
        Track track;
        if (c[1] == "audio") track = new AudioTrack(project.Tracks.Count, c[2]);
        else track = new VideoTrack(project.Tracks.Count, c[2]);
        track.Mute = c[3] == "1";
        track.Solo = c[4] == "1";
        AudioTrack audio = track as AudioTrack;
        if (audio != null)
        {
            if (c.Length > 5) audio.Volume = (float)Double(c[5], 1);
            if (c.Length > 6) audio.PanX = (float)Double(c[6], 0);
        }
        project.Tracks.Add(track);
        created.Add(track);
    }

    static void ReadEventLine(Project project, List<Track> created, string[] c)
    {
        if (c.Length < 10) { skipped.Add("Línea event incompleta."); return; }
        int trackIndex = Int(c[1], -1);
        if (trackIndex < 0 || trackIndex >= created.Count) { skipped.Add("Evento con pista inexistente: " + c[1]); return; }
        Track track = created[trackIndex];
        Timecode start = Timecode.FromSeconds(Double(c[4], 0));
        Timecode length = Timecode.FromSeconds(Double(c[5], 0));
        if (length.Nanos <= 0) { skipped.Add("Evento de duración cero en la pista " + c[1] + "."); return; }

        TrackEvent item;
        if (track.MediaType == MediaType.Audio) item = new AudioEvent(start, length);
        else item = new VideoEvent(start, length);

        string path = c[2];
        if (path != "-" && path.Length > 0)
        {
            if (!File.Exists(path)) { skipped.Add("No existe el archivo: " + path); return; }
            Media media = Media.CreateInstance(project, path);
            if (media == null) { skipped.Add("VEGAS no pudo abrir el medio: " + path); return; }
            MediaStream stream = null;
            if (track.MediaType == MediaType.Audio) stream = media.GetAudioStreamByIndex(0);
            else
            {
                stream = media.GetVideoStreamByIndex(0);
                if (stream == null) stream = media.GetAudioStreamByIndex(0);
            }
            if (stream == null) { skipped.Add("El medio no tiene pista utilizable: " + path); return; }
            Take take = new Take(stream);
            take.Offset = Timecode.FromSeconds(Double(c[6], 0));
            item.Takes.Add(take);
        }
        else
        {
            skipped.Add("Evento sin archivo (texto, color o generador) en la pista " + c[1] + ": la API de VEGAS lo necesita aparte.");
            return;
        }

        double speed = Double(c[9], 1);
        if (speed < 0.25) speed = 0.25;
        if (speed > 4) speed = 4;
        item.PlaybackRate = speed;
        item.FadeIn.Length = Timecode.FromSeconds(Double(c[7], 0));
        item.FadeOut.Length = Timecode.FromSeconds(Double(c[8], 0));
        if (c.Length > 10)
        {
            double rotation = Double(c[10], 0);
            VideoEvent video = item as VideoEvent;
            if (video != null && Math.Abs(rotation) > 0.0001)
            {
                if (video.VideoMotion.Keyframes.Count == 0)
                    video.VideoMotion.Keyframes.Add(new VideoMotionKeyframe(project, start));
                video.VideoMotion.Keyframes[0].Rotation = rotation;
            }
        }
        track.Events.Add(item);
    }

    static void ReadMarkerLine(Project project, string[] c)
    {
        if (c.Length < 2) return;
        Marker marker = new Marker(Timecode.FromSeconds(Double(c[1], 0)));
        if (c.Length > 2) marker.Label = c[2];
        project.Markers.Add(marker);
    }

    static void ReadRegionLine(Project project, string[] c)
    {
        if (c.Length < 3) return;
        Region region = new Region(Timecode.FromSeconds(Double(c[1], 0)), Timecode.FromSeconds(Double(c[2], 0)));
        if (c.Length > 3) region.Label = c[3];
        project.Regions.Add(region);
    }

    static int Int(string value, int fallback)
    {
        int parsed;
        if (Int32.TryParse(value, NumberStyles.Integer, invariant, out parsed)) return parsed;
        return fallback;
    }

    static double Double(string value, double fallback)
    {
        double parsed;
        if (Double.TryParse(value, NumberStyles.Float, invariant, out parsed)) return parsed;
        return fallback;
    }

    // ------------------------------------------------------------------ JSON mínimo

    class Json
    {
        readonly StringBuilder b = new StringBuilder();
        readonly Stack<bool> first = new Stack<bool>();
        bool pendingKey;

        void Sep()
        {
            if (pendingKey) { pendingKey = false; return; }
            if (first.Count > 0)
            {
                if (!first.Peek()) b.Append(',');
                first.Pop();
                first.Push(false);
            }
        }

        public Json O() { Sep(); b.Append('{'); first.Push(true); return this; }
        public Json A() { Sep(); b.Append('['); first.Push(true); return this; }
        public Json E() { b.Append('}'); if (first.Count > 0) first.Pop(); return this; }
        public Json e() { b.Append(']'); if (first.Count > 0) first.Pop(); return this; }
        public Json C() { return this; }
        public Json K(string key) { Sep(); b.Append(Quote(key)).Append(':'); pendingKey = true; return this; }

        public Json V(string value) { Sep(); b.Append(value == null ? "null" : Quote(value)); return this; }
        public Json V(bool value) { Sep(); b.Append(value ? "true" : "false"); return this; }
        public Json V(long value) { Sep(); b.Append(value.ToString(invariant)); return this; }
        public Json V(double value)
        {
            Sep();
            if (Double.IsNaN(value) || Double.IsInfinity(value)) b.Append("null");
            else b.Append(value.ToString("R", invariant));
            return this;
        }

        static string Quote(string value)
        {
            StringBuilder q = new StringBuilder("\"");
            for (int index = 0; index < value.Length; index++)
            {
                char ch = value[index];
                if (ch == '"' || ch == '\\') q.Append('\\').Append(ch);
                else if (ch == '\n') q.Append("\\n");
                else if (ch == '\r') q.Append("\\r");
                else if (ch == '\t') q.Append("\\t");
                else if (ch < ' ') q.Append("\\u").Append(((int)ch).ToString("x4", invariant));
                else q.Append(ch);
            }
            return q.Append('"').ToString();
        }

        public override string ToString() { return b.ToString(); }
    }
}
