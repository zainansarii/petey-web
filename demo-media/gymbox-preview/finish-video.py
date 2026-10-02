"""Finish and verify the exact 52-second delivery. Requires FFmpeg and FFprobe on PATH."""
from pathlib import Path
import hashlib,json,os,re,shutil,subprocess
ROOT=Path(__file__).resolve().parent
FF=os.environ.get('FFMPEG') or shutil.which('ffmpeg')
FP=os.environ.get('FFPROBE') or shutil.which('ffprobe')
if not FF or not FP: raise SystemExit('Install FFmpeg/FFprobe or set FFMPEG and FFPROBE.')
def run(args): return subprocess.run(args,check=True,capture_output=True)
raw=ROOT/'render-master.mp4'; final=ROOT/'gymbox-preview.mp4'; poster=ROOT/'gymbox-preview.jpg'
qa=ROOT/'qa';qa.mkdir(exist_ok=True)
# Frame zero is authored as a fully settled directory/title composition.
run([FF,'-y','-v','error','-ss','0','-i',str(raw),'-frames:v','1','-q:v','2',str(poster)])
run([FF,'-y','-v','error','-i',str(raw),'-i',str(poster),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",'-map','[v]','-map','0:a:0','-c:v','libx264','-crf','17','-preset','slow','-pix_fmt','yuv420p','-c:a','copy','-t','52','-movflags','+faststart',str(final)])
run([FF,'-v','error','-i',str(final),'-f','null','-'])
probe=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',str(final)]).stdout)
v=next(x for x in probe['streams'] if x['codec_type']=='video');a=next(x for x in probe['streams'] if x['codec_type']=='audio')
assert (v['width'],v['height'])==(1920,1080)
assert v['r_frame_rate']=='30/1' and int(v['nb_frames'])==1560
assert abs(float(probe['format']['duration'])-52)<.00001
assert len(probe['streams'])==2 and a['channels']==2
levels=run([FF,'-hide_banner','-nostats','-i',str(final),'-af','ebur128=peak=true','-f','null','-']).stderr.decode()
(qa/'final-loudness.log').write_text(levels)
short=[]
for line in levels.splitlines():
 m=re.search(r't:\s*([\d.]+).*M:\s*([-\d.]+)\s+S:\s*([-\d.]+)',line)
 if m and float(m[1])>=3:short.append(float(m[3]))
assert max(short)-min(short)<2.2
peak=float(re.findall(r'Peak:\s*([-\d.]+) dBFS',levels)[-1]);assert peak < -1
def audio_hash(p):return hashlib.sha256(run([FF,'-v','error','-i',str(p),'-map','0:a:0','-c','copy','-f','adts','-']).stdout).hexdigest()
assert audio_hash(raw)==audio_hash(final)
times=[0,4.9,7.5,11,14.125,18.5,20.8,25.1,30.125,36.375,40.125,43.625,47.375,51.966]
for i,t in enumerate(times):run([FF,'-y','-v','error','-ss',str(t),'-i',str(final),'-frames:v','1','-q:v','2',str(qa/f'final-frame-{i:02}.jpg')])
run([FF,'-y','-v','error','-framerate','1','-i',str(qa/'final-frame-%02d.jpg'),'-vf','scale=480:270,tile=4x4:padding=4:margin=4:color=0x202020','-frames:v','1','-q:v','2',str(qa/'final-contact-sheet.jpg')])
transition_times=[5.6,5.75,6.1,19.3,19.5,19.9,28.1,28.25,28.6,38.1,38.25,38.6,48.1,48.25,48.7]
for i,t in enumerate(transition_times):run([FF,'-y','-v','error','-ss',str(t),'-i',str(final),'-frames:v','1','-q:v','2',str(qa/f'transition-{i:02}.jpg')])
run([FF,'-y','-v','error','-framerate','1','-i',str(qa/'transition-%02d.jpg'),'-vf','scale=480:270,tile=3x5:padding=4:margin=4:color=0x202020','-frames:v','1','-q:v','2',str(qa/'transitions-contact-sheet.jpg')])
report={'file':final.name,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'reference_sha256':'d0a0a10d7133b997d67dc393189e828bc8dea1d883a019f27cbc1d09f7e76025','transition_sample_times':transition_times,'duration':52,'resolution':[1920,1080],'fps':30,'frames':1560,'video_codec':v['codec_name'],'audio_codec':a['codec_name'],'audio_source':'Existing levelled Alita Zayner 34–86s excerpt, fixed 0.5 gain','music_only':True,'narration':False,'sfx':False,'audio_stream_preserved_after_poster':True,'short_term_loudness_range_lu':round(max(short)-min(short),2),'true_peak_dbfs':peak,'scene_boundaries_seconds':[0,5.75,19.5,28.25,38.25,48.25,52],'full_decode':'passed','full_decode_exit_status':0,'finish_exit_status':0,'poster_timestamp_seconds':0,'poster_reason':'Settled title and synthetic trainer directory; baked into frame zero','bytes':final.stat().st_size,'synthetic_identities':10,'featured_identities':['Amira Hassan','Emma Carter','Grace Ellis'],'featured_clubs':['Bank','Bank','Bank'],'admin_capture_method':'Hyperframes static snapshots of isolated final actual Gymbox component with reference presentation CSS'}
(qa/'verification.json').write_text(json.dumps(report,indent=2)+'\n');(qa/'ffprobe.json').write_text(json.dumps(probe,indent=2)+'\n')
print(json.dumps(report,indent=2))
