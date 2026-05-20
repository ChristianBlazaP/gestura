import sys

path = r'c:\Users\LouPen\Downloads\GESTURA-PATATE-CONTEST\gestura\frontend\src\pages\InterpreterPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = r'''      {/* Main grid */}
      <main className="fade-up flex-1 max-w-[1600px] w-full mx-auto flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6 h-full min-h-[800px]">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1">
          
          {/* LEFT: YOU & PARTNER VIDEOS (Takes 8 columns) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[500px]">
                {/* YOU CARD */}
                <div className="surface-card flex flex-col overflow-hidden rounded-2xl relative shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-white/10 group">
                   {/* Header */}
                   <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 z-10">
                     <div className="flex items-center gap-3">
                       <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse"></div>
                       <h2 className="text-sm font-bold tracking-wide uppercase text-white">You</h2>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-emerald-400/90 bg-emerald-400/10 px-2 py-1.5 rounded-md border border-emerald-500/20 uppercase tracking-wide">
                          Detection: {detectionConfidence}%
                        </span>
                     </div>
                   </div>

                   {/* Video Area */}
                   <div className="relative flex-1 bg-gradient-to-b from-slate-900 to-black flex flex-col overflow-hidden">
                     <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                        style={{ transform: "scaleX(-1)" }}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 pointer-events-none"
                      />
                      {/* Video Overlays */}
                      <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end transition-opacity">
                         <div className="flex items-end justify-between">
                            <div>
                               <p className="text-[11px] text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">Live Sign</p>
                               <p className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{localLabel}</p>
                            </div>
                            {confirmedLetter && (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_rgba(52,211,153,0.3)]">
                                 <span className="text-3xl sm:text-4xl font-bold text-emerald-300 drop-shadow-md">{confirmedLetter}</span>
                              </div>
                            )}
                         </div>
                      </div>
                      {!isCameraOn && (
                         <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
                            <button onClick={startCamera} className="btn-primary px-6 py-3 rounded-xl shadow-[0_8px_20px_rgba(52,211,153,0.3)] hover:scale-105 transition-all flex items-center gap-2 font-medium">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                               Turn On Camera
                            </button>
                         </div>
                      )}
                   </div>

                   {/* Footer / Controls */}
                   <div className="p-4 sm:p-5 bg-slate-900/80 border-t border-white/5 flex flex-col gap-4 backdrop-blur-md z-10">
                      <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Message</span>
                            <span className="text-emerald-300 font-mono text-lg leading-none">{letterSequence.join("") || <span className="opacity-30">...</span>}</span>
                         </div>
                      </div>
                      <div className="flex items-center justify-between">
                         <label className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white cursor-pointer transition-colors select-none group-hover:opacity-100">
                           <div className="relative flex items-center justify-center">
                             <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} className="peer sr-only" />
                             <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                           </div>
                           <span className="font-medium text-xs tracking-wide">Auto-speak</span>
                         </label>
                         
                         <div className="flex items-center gap-2">
                           {isCameraOn && (
                              <button onClick={stopCamera} className="px-3.5 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors text-xs font-semibold">Stop</button>
                           )}
                           <button onClick={() => speakLettersThenPhrase(letterSequence, true)} className="px-3.5 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm">Speak</button>
                           <button onClick={() => {
                              resetSpeechState({
                                 setLetterSequence,
                                 setConfirmedLetter,
                                 lastSpokenRef,
                                 candidateRef,
                                 frameHistory,
                                 labelHistory,
                                 noDetectionTimeout,
                                 skipSpeakRef,
                                 speakingRef,
                                 letterSequenceRef,
                                 lastAutoSpokenPhraseRef,
                                 pendingAutoSpeakRef,
                              });
                              sendRoomPayload({ type: "clear-letters" });
                           }} className="px-3.5 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm">Clear</button>
                         </div>
                      </div>
                   </div>
                </div>

                {/* PARTNER CARD */}
                <div className="surface-card flex flex-col overflow-hidden rounded-2xl relative shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-white/10 group">
                   {/* Header */}
                   <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 z-10">
                     <div className="flex items-center gap-3">
                       <div className={`w-2.5 h-2.5 rounded-full ${remoteActive ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`}></div>
                       <h2 className="text-sm font-bold tracking-wide uppercase text-white">Partner</h2>
                     </div>
                     {roomJoined && (
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-500/20 shadow-inner">
                             {roomCode}
                           </span>
                           <button onClick={copyRoomCode} className="relative p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors" title="Copy Room Code">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              {copyMsg && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap shadow-lg">{copyMsg}</span>}
                           </button>
                        </div>
                     )}
                   </div>

                   {/* Partner Video Area */}
                   <div className="relative flex-1 bg-gradient-to-b from-slate-900 to-black flex flex-col overflow-hidden">
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${remoteActive ? "opacity-80" : "opacity-0"}`}
                        style={{ transform: "scaleX(-1)" }}
                      />
                      
                      {remoteActive && (
                        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end z-20">
                           <div className="flex items-end justify-between">
                              <div>
                                 <p className="text-[11px] text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">Live Sign</p>
                                 <p className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{remoteLiveLabel}</p>
                              </div>
                              {remoteConfirmedLetter && (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_rgba(52,211,153,0.3)]">
                                   <span className="text-3xl sm:text-4xl font-bold text-emerald-300 drop-shadow-md">{remoteConfirmedLetter}</span>
                                </div>
                              )}
                           </div>
                        </div>
                      )}
                      
                      {!roomJoined && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30 p-6 sm:p-8">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
                              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-1 tracking-wide">Connect with Partner</h3>
                            <p className="text-xs text-slate-400 text-center mb-6">Start a call to see remote signs</p>
                            <div className="flex flex-col gap-3 w-full max-w-[260px]">
                               <button onClick={handleCreateRoom} className="btn-primary w-full py-3 rounded-xl shadow-[0_8px_20px_rgba(52,211,153,0.25)] hover:scale-[1.02] transition-all font-medium text-sm">Create New Room</button>
                               <div className="flex items-center gap-3 my-1 opacity-60">
                                  <div className="h-px bg-white/20 flex-1"></div>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">or</span>
                                  <div className="h-px bg-white/20 flex-1"></div>
                                </div>
                               <div className="flex flex-col gap-2.5">
                                  <input type="text" value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="Enter Room Code" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-center tracking-wide" />
                                  <button onClick={() => handleJoinRoom()} disabled={!roomCode.trim()} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed">Join Room</button>
                               </div>
                            </div>
                         </div>
                      )}

                      {roomJoined && !remoteActive && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30 p-6 text-center">
                            <div className="relative w-16 h-16 mb-6">
                               <div className="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                               <div className="absolute inset-0 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                               </div>
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Waiting for partner</h3>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                               Share code: 
                               <span className="font-mono text-emerald-300 bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-500/20">{roomCode}</span>
                            </p>
                         </div>
                      )}
                   </div>
                   
                   {/* Partner Footer */}
                   <div className="p-4 sm:p-5 bg-slate-900/80 border-t border-white/5 flex flex-col gap-4 backdrop-blur-md z-10">
                      <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Message</span>
                            <span className="text-emerald-300 font-mono text-lg leading-none">{remoteLetters.join("") || <span className="opacity-30">...</span>}</span>
                         </div>
                      </div>
                      <div className="flex items-center justify-between">
                         <label className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white cursor-pointer transition-colors select-none group-hover:opacity-100">
                           <div className="relative flex items-center justify-center">
                             <input type="checkbox" checked={remoteAutoSpeak} onChange={(e) => setRemoteAutoSpeak(e.target.checked)} className="peer sr-only" />
                             <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                           </div>
                           <span className="font-medium text-xs tracking-wide">Auto-speak</span>
                         </label>
                         
                         <div className="flex items-center gap-2">
                           {roomJoined && (
                              <button onClick={handleLeaveRoom} className="px-3.5 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors text-xs font-semibold">Leave</button>
                           )}
                           <button onClick={() => speakLettersThenPhrase(remoteLetters, true)} className="px-3.5 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm">Speak</button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* RIGHT: CHAT (Takes 4 columns) */}
          <div className="lg:col-span-4 h-[600px] lg:h-auto flex flex-col">
             <div className="surface-card flex flex-col h-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-white/10">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 z-10">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <h2 className="text-sm font-bold tracking-wide uppercase text-white">Live Chat</h2>
                   </div>
                   <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full ${roomJoined ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]' : 'bg-slate-800 text-slate-400 border border-white/5'}`}>
                      {roomJoined ? 'Connected' : 'Offline'}
                   </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gradient-to-b from-slate-900/60 to-slate-950/80">
                   {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                         <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                            <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                         </div>
                         <p className="text-sm font-medium">No messages yet.</p>
                      </div>
                   ) : (
                      chatMessages.map((msg, i) => (
                         <div key={i} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"} animate-[fadeUp_0.3s_ease_both]`}>
                            <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-md ${msg.from === "me" ? "bg-emerald-500 text-emerald-950 rounded-br-sm font-medium" : "bg-slate-800 border border-white/5 text-slate-100 rounded-bl-sm"}`}>
                               {msg.text}
                            </div>
                         </div>
                      ))
                   )}
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (typeof handleSendChat === 'function') handleSendChat(e);
                }} className="p-4 sm:p-5 bg-black/40 border-t border-white/5 backdrop-blur-md">
                   <div className="relative flex items-center">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={roomJoined ? "Type your message..." : "Join a room to chat"}
                        disabled={!roomJoined}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-full pl-5 pr-14 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all disabled:opacity-40 shadow-inner"
                      />
                      <button type="submit" disabled={!roomJoined || !chatInput.trim()} className="absolute right-2 w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-[0_4px_12px_rgba(52,211,153,0.3)] disabled:shadow-none">
                         <svg className="w-4 h-4 translate-x-[1px] translate-y-[-1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                   </div>
                </form>
             </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer-min mt-2 pt-4 text-xs font-medium tracking-wider text-center opacity-60">
          GESTURA 2025
        </footer>
      </main>
'''

start_index = -1
end_index = -1
for i, line in enumerate(lines):
    if "{/* Main grid */}" in line:
        start_index = i
        break
for i in range(len(lines)-1, -1, -1):
    if "</main>" in lines[i]:
        end_index = i
        break

if start_index != -1 and end_index != -1:
    lines = lines[:start_index] + [new_content + '\n'] + lines[end_index+1:]
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully replaced the main section")
else:
    print(f"Could not find start or end tags. start: {start_index}, end: {end_index}")
