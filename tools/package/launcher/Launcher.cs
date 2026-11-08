// The zip's launcher, "Murder at Sinclair Mansion.exe": starts this player's own game server
// (game\launch.mjs on the bundled game\node\node.exe) with no console window, in a small window
// on the taskbar. While the server boots the window shows a loading bar (driven by the server's
// boot log); once it answers, the game opens in the browser and the window offers Open game,
// Show log and Quit. Closing the window stops the server. The server's output goes to
// game\logs\server.log; if it stops on its own, the player is told why.
//
// Compiled by tools/package/build-zip.js with the C# compiler that ships with Windows (.NET
// Framework 4, so C# 5: no string interpolation or ?. here).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

static class Launcher
{
    public const string Title = "Murder at Sinclair Mansion";

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    /// <summary>Set after an update was installed (or failed to): start this exe again once the mutex is released.</summary>
    public static string RestartArgs;
    /// <summary>Started by a finished update: the game's tab reloads by itself, so don't open another.</summary>
    public static bool JustUpdated;

    [STAThread]
    static void Main(string[] args)
    {
        JustUpdated = Array.IndexOf(args, "--updated") >= 0;
        try { SetProcessDPIAware(); }
        catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string game = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "game");
        string node = Path.Combine(game, Path.Combine("node", "node.exe"));
        int port;
        if (!int.TryParse(Environment.GetEnvironmentVariable("PORT"), out port) || port <= 0) port = 43594;
        string url = "http://localhost:" + port + "/";

        // Already running on this port (double-clicked twice): just show the game again.
        bool first;
        using (var running = new Mutex(true, "SinclairMansion-" + port, out first))
        {
            // After an update the old launcher may still be closing: wait for it.
            if (!first && JustUpdated)
            {
                try { first = running.WaitOne(15000); }
                catch (AbandonedMutexException) { first = true; }
            }
            if (!first)
            {
                OpenUrl(url);
                return;
            }
            if (!File.Exists(node))
            {
                MessageBox.Show("The game files are missing (" + node + ").\n\nUnzip the whole folder and run the game from there.", Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            Application.Run(new GameWindow(game, node, port, url));
            try { running.ReleaseMutex(); }
            catch { }
        }
        if (RestartArgs != null)
        {
            try { Process.Start(new ProcessStartInfo(Application.ExecutablePath, RestartArgs) { UseShellExecute = false, WorkingDirectory = InstallDir }); }
            catch (Exception e) { MessageBox.Show("Couldn't start the game again: " + e.Message + "\n\nStart it yourself.", Title, MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        }
    }

    /// <summary>The folder holding this exe, game\ and (while updating) update\.</summary>
    public static string InstallDir
    {
        get { return AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar); }
    }

    public static void OpenUrl(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch { }
    }
}

/// <summary>The launcher's window, and the game server it owns.</summary>
class GameWindow : Form
{
    const int TailLines = 20;

    static readonly Color Back = Color.FromArgb(30, 23, 18);
    static readonly Color Gold = Color.FromArgb(255, 176, 56);
    static readonly Color Text_ = Color.FromArgb(222, 210, 188);
    static readonly Color Muted = Color.FromArgb(150, 136, 114);
    static readonly Color ButtonBack = Color.FromArgb(58, 44, 32);

    /// <summary>Lines of the server's boot log, how far along each one is (%), and what to say.</summary>
    static readonly object[][] Milestones =
    {
        new object[] { "Boot: starting server", 42, "Starting the game server..." },
        new object[] { "Boot: initializing cache", 45, "Loading the game cache..." },
        new object[] { "Boot: cache ready", 52, "Loading the game cache..." },
        new object[] { "Boot: creating map collision", 55, "Loading Sinclair Mansion..." },
        new object[] { "Boot: map collision service ready", 64, "Loading Sinclair Mansion..." },
        new object[] { "Boot: creating gamemode", 67, "Setting up the murder..." },
        new object[] { "Boot: constructing WebSocket", 72, "Loading the household..." },
        new object[] { "[services] Phase 1", 84, "Loading the household..." },
        new object[] { "[services] All services", 88, "Waking up the servants..." },
        new object[] { "Boot: WebSocket server constructed", 92, "Almost ready..." },
        new object[] { "Boot: game ticker started", 96, "Almost ready..." },
    };
    /// <summary>Before the first milestone the server is loading its code (several seconds, no log).</summary>
    const float FirstCap = 40;

    readonly string game, node, url, logPath;
    readonly int port;
    readonly Queue<string> tail = new Queue<string>();
    readonly Label status, detail;
    readonly LoadingBar bar;
    readonly Button openButton, logButton, quitButton;
    readonly System.Windows.Forms.Timer animation = new System.Windows.Forms.Timer { Interval = 30 };
    readonly Stopwatch since = Stopwatch.StartNew();
    Process server;
    StreamWriter log;
    IntPtr job;
    float target = 2;        // where the bar is heading (%); it creeps on between milestones
    float cap = FirstCap;    // how far it may creep before the next milestone
    volatile bool ready, stopping;

    public GameWindow(string game, string node, int port, string url)
    {
        this.game = game;
        this.node = node;
        this.port = port;
        this.url = url;
        logPath = Path.Combine(game, Path.Combine("logs", "server.log"));

        Text = Launcher.Title;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Back;
        ForeColor = Text_;
        Font = new Font("Segoe UI", 9f);
        AutoScaleDimensions = new SizeF(96f, 96f);
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(460, 222);

        var picture = new PictureBox
        {
            Image = new Icon(Icon, new Size(48, 48)).ToBitmap(),
            SizeMode = PictureBoxSizeMode.Zoom,
            Bounds = new Rectangle(20, 20, 48, 48),
        };
        var title = new Label
        {
            Text = Launcher.Title,
            Font = new Font("Georgia", 15f, FontStyle.Bold),
            ForeColor = Gold,
            AutoSize = true,
            Location = new Point(78, 20),
        };
        var subtitle = new Label
        {
            Text = "Your own copy of the game: friends join it with your room code.",
            ForeColor = Muted,
            AutoSize = true,
            Location = new Point(80, 50),
        };
        status = new Label { Text = "Loading the game code...", Font = new Font("Segoe UI", 10f, FontStyle.Bold), Bounds = new Rectangle(20, 88, 420, 22) };
        bar = new LoadingBar { Bounds = new Rectangle(20, 114, 420, 14) };
        detail = new Label { Text = "The game opens in your browser when it's ready.", ForeColor = Muted, Bounds = new Rectangle(20, 134, 420, 36) };
        openButton = MakeButton("Open game", new Rectangle(120, 176, 100, 30), true);
        logButton = MakeButton("Show log", new Rectangle(230, 176, 100, 30), false);
        quitButton = MakeButton("Cancel", new Rectangle(340, 176, 100, 30), false);
        openButton.Visible = false;
        openButton.Click += delegate { Launcher.OpenUrl(url); };
        logButton.Click += delegate { Launcher.OpenUrl(logPath); };
        quitButton.Click += delegate { Close(); };
        Controls.AddRange(new Control[] { picture, title, subtitle, status, bar, detail, openButton, logButton, quitButton });

        animation.Tick += delegate { Animate(); };
    }

    Button MakeButton(string text, Rectangle bounds, bool primary)
    {
        var button = new Button
        {
            Text = text,
            Bounds = bounds,
            FlatStyle = FlatStyle.Flat,
            BackColor = ButtonBack,
            ForeColor = primary ? Gold : Text_,
            Font = new Font("Segoe UI", 9f, primary ? FontStyle.Bold : FontStyle.Regular),
            Cursor = Cursors.Hand,
        };
        button.FlatAppearance.BorderColor = primary ? Gold : Color.FromArgb(96, 78, 58);
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(78, 60, 42);
        return button;
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        animation.Start();
        Taskbar.SetProgress(Handle, 0);
        // What an earlier update left behind (the old version's folder), out of the way.
        new Thread(delegate () { GameUpdate.CleanUp(Launcher.InstallDir); }) { IsBackground = true, Priority = ThreadPriority.BelowNormal }.Start();
        try { StartServer(); }
        catch (Exception error)
        {
            stopping = true;
            MessageBox.Show(this, "The game server couldn't start:\n\n" + error.Message, Launcher.Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    void StartServer()
    {
        string logs = Path.GetDirectoryName(logPath);
        Directory.CreateDirectory(logs);
        string previous = Path.Combine(logs, "server.previous.log");
        try
        {
            if (File.Exists(previous)) File.Delete(previous);
            if (File.Exists(logPath)) File.Move(logPath, previous);
        }
        catch { }
        log = new StreamWriter(logPath, true, new UTF8Encoding(false)) { AutoFlush = true };

        // Everything the server starts lives in this job, so quitting (or this launcher crashing)
        // never leaves a game server running in the background.
        job = Job.Create();

        var start = new ProcessStartInfo(node, "\"" + Path.Combine(game, "launch.mjs") + "\"")
        {
            WorkingDirectory = game,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        start.EnvironmentVariables["PORT"] = port.ToString();
        start.EnvironmentVariables["SINCLAIR_NO_BROWSER"] = "1"; // opened from here, outside the job
        // Lets the game's updater download into <install>\update (GameUpdate installs it).
        start.EnvironmentVariables["SINCLAIR_LAUNCHER"] = "1";
        start.EnvironmentVariables["SINCLAIR_INSTALL_DIR"] = Launcher.InstallDir;
        server = new Process { StartInfo = start, EnableRaisingEvents = true };
        server.OutputDataReceived += (s, e) => Log(e.Data);
        server.ErrorDataReceived += (s, e) => Log(e.Data);
        server.Exited += delegate { if (!stopping) Post(ServerStopped); };
        server.Start();
        Job.Add(job, server);
        server.BeginOutputReadLine();
        server.BeginErrorReadLine();

        new Thread(WaitUntilReady) { IsBackground = true }.Start();
    }

    /// <summary>Runs `action` on the window's thread (from the server's threads), unless it's gone.</summary>
    void Post(MethodInvoker action)
    {
        try { if (IsHandleCreated && !IsDisposed) BeginInvoke(action); }
        catch (InvalidOperationException) { }
    }

    void Log(string line)
    {
        if (line == null) return;
        lock (tail)
        {
            try { if (log != null) log.WriteLine(line); }
            catch { }
            tail.Enqueue(line);
            while (tail.Count > TailLines) tail.Dequeue();
        }
        for (int i = 0; i < Milestones.Length; i++)
        {
            if (line.IndexOf((string)Milestones[i][0], StringComparison.Ordinal) < 0) continue;
            int percent = (int)Milestones[i][1];
            string text = (string)Milestones[i][2];
            int next = i + 1 < Milestones.Length ? (int)Milestones[i + 1][1] : 99;
            Post(delegate
            {
                if (ready || percent < target) return;
                target = percent;
                cap = next - 1;
                status.Text = text;
            });
            return;
        }
    }

    /// <summary>Moves the bar toward its target, creeping on slowly so it never looks stuck.</summary>
    void Animate()
    {
        if (!ready)
        {
            // Eases toward the cap: quick at first, slower the longer a step takes, never stopping.
            if (target < cap) target += (cap - target) * 0.006f;
            if (since.Elapsed.TotalSeconds > 45 && detail.Tag == null)
            {
                detail.Tag = "slow";
                detail.Text = "This is taking longer than usual (the first start after unzipping can take a minute or two).";
            }
        }
        bar.Value += (target - bar.Value) * 0.12f;
        bar.Phase += 0.02f;
        bar.Sheen = !ready || bar.Value <= 99.5f;
        bar.Invalidate();
        Taskbar.SetProgress(Handle, ready ? -1 : (int)bar.Value);
        if (ready && bar.Value > 99.5f) animation.Stop();
    }

    /// <summary>Opens the game once the server answers /status (it takes a little while to load the map).</summary>
    void WaitUntilReady()
    {
        while (!stopping && !server.HasExited)
        {
            if (Answers())
            {
                Post(Ready);
                return;
            }
            Thread.Sleep(500);
        }
    }

    bool Answers()
    {
        try
        {
            // Not "localhost": Windows retries a refused ::1 for ~2 s before trying IPv4.
            var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/status");
            request.Timeout = 2000;
            request.Proxy = null;
            using (request.GetResponse()) return true;
        }
        catch (WebException e)
        {
            // Any HTTP answer, even an error status, means the server is up.
            if (e.Response == null) return false;
            e.Response.Close();
            return true;
        }
    }

    void Ready()
    {
        if (stopping) return;
        ready = true;
        target = 100;
        status.Text = "Your game is running";
        status.ForeColor = Gold;
        detail.Text = "Playing at " + url + "\nKeep this window open while you play: closing it stops the game.";
        openButton.Visible = true;
        quitButton.Text = "Quit";
        if (Launcher.JustUpdated)
        {
            status.Text = "Updated! Your game is running";
            return; // the game's tab reloads itself
        }
        Launcher.OpenUrl(url);
    }

    void ServerStopped()
    {
        if (stopping) return;
        stopping = true;
        animation.Stop();
        // 64: the player chose Exit Game in the game's logout tab. Quit without a fuss.
        if (server.ExitCode == 64)
        {
            Close();
            return;
        }
        // 65: the player chose Update in the main menu and the new version is downloaded.
        if (server.ExitCode == GameUpdate.ExitCode)
        {
            InstallUpdate();
            return;
        }
        Taskbar.SetError(Handle);
        string lines;
        lock (tail) lines = string.Join("\n", tail.ToArray());
        string why = lines.Contains("EADDRINUSE")
            ? "Another program (maybe another copy of the game) is already using port " + port + ". Close it and try again, or start the game on another port (see README.txt)."
            : "The game server stopped (exit code " + server.ExitCode + "):\n\n" + lines;
        MessageBox.Show(this, why + "\n\nThe full log is in " + logPath, Launcher.Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
    }

    void InstallUpdate()
    {
        Job.Close(job);
        job = IntPtr.Zero;
        lock (tail)
        {
            if (log != null) log.Dispose();
            log = null;
        }
        status.ForeColor = Text_;
        status.Text = "Installing the update...";
        detail.Text = "Don't close this window: the game starts again by itself.";
        openButton.Visible = false;
        quitButton.Enabled = false;
        ready = false;
        target = 2;
        cap = 95;
        bar.Value = 0;
        animation.Start();
        new Thread(delegate ()
        {
            string error = null;
            try
            {
                GameUpdate.Install(Launcher.InstallDir, game, delegate (int percent, string text)
                {
                    Post(delegate { target = Math.Max(target, percent); if (text != null) status.Text = text; });
                });
            }
            catch (Exception e) { error = e.Message; }
            Post(delegate { UpdateFinished(error); });
        }) { IsBackground = true }.Start();
    }

    void UpdateFinished(string error)
    {
        if (error != null)
            MessageBox.Show(this, "The update couldn't be installed:\n\n" + error + "\n\nYour game wasn't changed and will start again now. You can also download the new version from GitHub.",
                Launcher.Title, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        Launcher.RestartArgs = error == null ? "--updated" : "";
        quitButton.Enabled = true;
        Close();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // Half-swapped folders would break the game: the install finishes first.
        if (quitButton != null && !quitButton.Enabled && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            return;
        }
        if (ready && !stopping && e.CloseReason == CloseReason.UserClosing)
        {
            var answer = MessageBox.Show(this, "Quit the game?\n\nThis stops your game server: anyone playing in your room will be disconnected.",
                Launcher.Title, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2);
            if (answer != DialogResult.Yes)
            {
                e.Cancel = true;
                return;
            }
        }
        stopping = true;
        animation.Stop();
        Job.Close(job); // ends the server and everything it started
        try { if (server != null && !server.HasExited) server.Kill(); }
        catch { }
        lock (tail)
        {
            if (log != null) log.Dispose();
            log = null;
        }
        base.OnFormClosing(e);
    }
}

/// <summary>
/// Installs an update the game server downloaded (server/src/update/Updater.ts) into
/// <install>\update\: SinclairMansion.zip plus ready.json naming its SHA-256. The server has
/// exited, so nothing holds the files: unpack the zip beside the game, carry the player's saves
/// over, then swap the game\ folder and this exe for the new ones (a running exe can be renamed,
/// not overwritten). The old ones are deleted on the next start.
/// </summary>
static class GameUpdate
{
    public const int ExitCode = 65;
    const string ZipRoot = "SinclairMansion";
    const string ExeName = Launcher.Title + ".exe";

    public delegate void Progress(int percent, string text);

    public static void Install(string install, string game, Progress progress)
    {
        string dir = Path.Combine(install, "update");
        string marker = Path.Combine(dir, "ready.json");
        string zipPath = Path.Combine(dir, "SinclairMansion.zip");
        if (!File.Exists(marker) || !File.Exists(zipPath)) throw new Exception("The downloaded update is missing.");
        Match hash = Regex.Match(File.ReadAllText(marker), "\"sha256\"\\s*:\\s*\"([0-9a-fA-F]{64})\"");
        if (!hash.Success) throw new Exception("The update's checksum is missing.");

        progress(5, "Checking the download...");
        string actual;
        using (var sha = SHA256.Create())
        using (var file = File.OpenRead(zipPath))
            actual = BitConverter.ToString(sha.ComputeHash(file)).Replace("-", "").ToLowerInvariant();
        if (actual != hash.Groups[1].Value.ToLowerInvariant()) throw new Exception("The download is damaged (its checksum doesn't match).");

        // Unpack into update\staged, refusing any entry that would land outside it.
        string staged = Path.Combine(dir, "staged");
        if (Directory.Exists(staged)) Directory.Delete(staged, true);
        Directory.CreateDirectory(staged);
        string stagedRoot = Path.GetFullPath(staged) + Path.DirectorySeparatorChar;
        using (ZipArchive zip = ZipFile.OpenRead(zipPath))
        {
            int done = 0, total = Math.Max(1, zip.Entries.Count);
            foreach (ZipArchiveEntry entry in zip.Entries)
            {
                string to = Path.GetFullPath(Path.Combine(staged, entry.FullName));
                if (!to.StartsWith(stagedRoot, StringComparison.OrdinalIgnoreCase)) throw new Exception("The update contains a bad path: " + entry.FullName);
                if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\")) Directory.CreateDirectory(to);
                else
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(to));
                    entry.ExtractToFile(to, true);
                }
                if (++done % 200 == 0) progress(10 + 70 * done / total, "Unpacking the update...");
            }
        }
        string fresh = Path.Combine(staged, ZipRoot);
        string freshGame = Path.Combine(fresh, "game");
        string freshExe = Path.Combine(fresh, ExeName);
        if (!File.Exists(Path.Combine(freshGame, Path.Combine("node", "node.exe"))) || !File.Exists(freshExe))
            throw new Exception("The update isn't a complete copy of the game.");

        // The player's server-side saves and the logs come along.
        progress(82, "Keeping your saves...");
        string saves = Path.Combine(game, Path.Combine("server", Path.Combine("data", "gamemodes")));
        if (Directory.Exists(saves))
            foreach (string mode in Directory.GetDirectories(saves))
                foreach (string file in Directory.GetFiles(mode, "game.sqlite*"))
                {
                    string to = Path.Combine(Path.Combine(freshGame, Path.Combine("server", Path.Combine("data", "gamemodes"))), Path.GetFileName(mode));
                    Directory.CreateDirectory(to);
                    File.Copy(file, Path.Combine(to, Path.GetFileName(file)), true);
                }
        string logs = Path.Combine(game, "logs");
        if (Directory.Exists(logs))
        {
            Directory.CreateDirectory(Path.Combine(freshGame, "logs"));
            foreach (string file in Directory.GetFiles(logs)) File.Copy(file, Path.Combine(Path.Combine(freshGame, "logs"), Path.GetFileName(file)), true);
        }

        // Swap. The server may take a moment to let go of its files.
        progress(90, "Installing...");
        string stamp = DateTime.Now.Ticks.ToString();
        string oldGame = Path.Combine(dir, "old-game-" + stamp);
        Retry(delegate { Directory.Move(game, oldGame); }, "The game's files are still in use. Close anything using the game folder and try again.");
        try { Directory.Move(freshGame, game); }
        catch
        {
            Directory.Move(oldGame, game);
            throw;
        }
        string exe = Application.ExecutablePath;
        string oldExe = Path.Combine(dir, "old-launcher-" + stamp + ".exe");
        try
        {
            File.Move(exe, oldExe);
            File.Move(freshExe, exe);
        }
        catch
        {
            // The new game folder still works with this launcher; it's replaced next time.
            if (!File.Exists(exe) && File.Exists(oldExe)) File.Move(oldExe, exe);
        }
        string readme = Path.Combine(fresh, "README.txt");
        try { if (File.Exists(readme)) File.Copy(readme, Path.Combine(install, "README.txt"), true); }
        catch { }

        progress(97, "Tidying up...");
        try { File.Delete(zipPath); File.Delete(marker); Directory.Delete(staged, true); }
        catch { }
    }

    /// <summary>Deletes what an earlier update left in update\ (old versions, half-done unpacking).</summary>
    public static void CleanUp(string install)
    {
        string dir = Path.Combine(install, "update");
        if (!Directory.Exists(dir)) return;
        try
        {
            foreach (string d in Directory.GetDirectories(dir))
            {
                string name = Path.GetFileName(d);
                if (name.StartsWith("old-") || name == "staged") try { Directory.Delete(d, true); } catch { }
            }
            foreach (string f in Directory.GetFiles(dir, "old-*")) try { File.Delete(f); } catch { }
        }
        catch { }
    }

    static void Retry(MethodInvoker action, string failure)
    {
        for (int i = 0; ; i++)
        {
            try
            {
                action();
                return;
            }
            catch (IOException)
            {
                if (i >= 20) throw new Exception(failure);
            }
            catch (UnauthorizedAccessException)
            {
                if (i >= 20) throw new Exception(failure);
            }
            Thread.Sleep(500);
        }
    }
}

/// <summary>A gold loading bar with a sheen sweeping across it.</summary>
class LoadingBar : Control
{
    public float Value; // 0-100
    public float Phase; // the sheen's position, wraps every 1
    public bool Sheen = true;

    public LoadingBar()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        var all = new Rectangle(0, 0, Width - 1, Height - 1);
        using (var track = new SolidBrush(Color.FromArgb(14, 10, 7))) g.FillRectangle(track, all);
        int fill = (int)Math.Round((Width - 2) * Math.Max(0, Math.Min(100, Value)) / 100);
        if (fill > 0)
        {
            var bar = new Rectangle(1, 1, fill, Height - 2);
            using (var gold = new LinearGradientBrush(bar, Color.FromArgb(255, 196, 84), Color.FromArgb(196, 116, 20), LinearGradientMode.Vertical))
                g.FillRectangle(gold, bar);
        }
        if (fill > 0 && Sheen)
        {
            var bar = new Rectangle(1, 1, fill, Height - 2);
            float p = Phase % 1f;
            int sheenWidth = Math.Max(30, Width / 5);
            int x = (int)(p * (Width + sheenWidth)) - sheenWidth;
            var sheen = new Rectangle(x, 1, sheenWidth, Height - 2);
            using (var light = new LinearGradientBrush(sheen, Color.FromArgb(0, 255, 255, 255), Color.FromArgb(0, 255, 255, 255), LinearGradientMode.Horizontal))
            {
                var blend = new ColorBlend
                {
                    Colors = new[] { Color.FromArgb(0, 255, 255, 255), Color.FromArgb(110, 255, 248, 220), Color.FromArgb(0, 255, 255, 255) },
                    Positions = new[] { 0f, 0.5f, 1f },
                };
                light.InterpolationColors = blend;
                g.SetClip(bar);
                g.FillRectangle(light, sheen);
                g.ResetClip();
            }
        }
        using (var border = new Pen(Color.FromArgb(96, 78, 58))) g.DrawRectangle(border, all);
    }
}

/// <summary>Progress on the window's taskbar button (Windows 7 and later).</summary>
static class Taskbar
{
    [ComImport, Guid("ea1afb91-9e28-4b86-90e9-9e9f8a5eefaf"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ITaskbarList3
    {
        void HrInit();
        void AddTab(IntPtr hwnd);
        void DeleteTab(IntPtr hwnd);
        void ActivateTab(IntPtr hwnd);
        void SetActiveAlt(IntPtr hwnd);
        void MarkFullscreenWindow(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool fullscreen);
        void SetProgressValue(IntPtr hwnd, ulong completed, ulong total);
        void SetProgressState(IntPtr hwnd, int state);
    }

    [ComImport, Guid("56fdf344-fd6d-11d0-958a-006097c9a090"), ClassInterface(ClassInterfaceType.None)]
    class TaskbarList { }

    const int NoProgress = 0, Normal = 2, Error = 4;
    static ITaskbarList3 list;
    static bool failed;

    static ITaskbarList3 List()
    {
        if (list == null && !failed)
        {
            try
            {
                list = (ITaskbarList3)new TaskbarList();
                list.HrInit();
            }
            catch { failed = true; list = null; }
        }
        return list;
    }

    /// <summary>Shows `percent` on the taskbar button, or clears it when negative.</summary>
    public static void SetProgress(IntPtr hwnd, int percent)
    {
        var taskbar = List();
        if (taskbar == null) return;
        try
        {
            if (percent < 0) taskbar.SetProgressState(hwnd, NoProgress);
            else
            {
                taskbar.SetProgressState(hwnd, Normal);
                taskbar.SetProgressValue(hwnd, (ulong)percent, 100);
            }
        }
        catch { }
    }

    public static void SetError(IntPtr hwnd)
    {
        var taskbar = List();
        if (taskbar == null) return;
        try
        {
            taskbar.SetProgressState(hwnd, Error);
            taskbar.SetProgressValue(hwnd, 100, 100);
        }
        catch { }
    }
}

/// <summary>A Windows job object that ends its processes when closed.</summary>
static class Job
{
    const int JobObjectExtendedLimitInformation = 9;
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits
    {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll")]
    static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);

    [DllImport("kernel32.dll")]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    public static IntPtr Create()
    {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        var limits = new ExtendedLimits();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        int size = Marshal.SizeOf(typeof(ExtendedLimits));
        IntPtr info = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(limits, info, false);
            SetInformationJobObject(job, JobObjectExtendedLimitInformation, info, (uint)size);
        }
        finally { Marshal.FreeHGlobal(info); }
        return job;
    }

    public static void Add(IntPtr job, Process process)
    {
        if (job != IntPtr.Zero) AssignProcessToJobObject(job, process.Handle);
    }

    public static void Close(IntPtr job)
    {
        if (job != IntPtr.Zero) CloseHandle(job);
    }
}
