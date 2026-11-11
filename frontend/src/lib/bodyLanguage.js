const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function headPose(landmarks) {
  const nose = landmarks[1]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  const chin = landmarks[152]
  const forehead = landmarks[10]
  if (!nose || !leftEye || !rightEye || !chin || !forehead) return null

  const eyeDist = distance(leftEye, rightEye) || 0.001
  const midX = (leftEye.x + rightEye.x) / 2
  const midY = (leftEye.y + rightEye.y) / 2
  const faceHeight = Math.abs(chin.y - forehead.y) || 0.001
  return {
    yaw: (nose.x - midX) / eyeDist,
    pitch: (nose.y - midY) / faceHeight,
    eyeDist,
  }
}

function visible(point) {
  return !!point && (point.visibility ?? 1) >= 0.5
}

export function interpretBodyLanguage(faceResult, poseResult) {
  const faces = faceResult?.faceLandmarks || []
  const poses = poseResult?.landmarks || []
  const anomalies = []

  if (faces.length === 0) {
    anomalies.push({ code: 'no_face', label: 'Face is not in frame' })
  } else if (faces.length > 1) {
    anomalies.push({ code: 'multiple_people', label: 'More than one person is in frame' })
  }

  if (faces[0]) {
    const pose = headPose(faces[0])
    if (pose) {
      if (pose.eyeDist < 0.045) {
        anomalies.push({ code: 'too_far', label: 'Too far from the camera' })
      } else if (pose.eyeDist > 0.28) {
        anomalies.push({ code: 'too_close', label: 'Too close to the camera' })
      }
      if (Math.abs(pose.yaw) > 0.6) {
        anomalies.push({ code: 'looking_away', label: 'Looking away from the camera' })
      }
      if (pose.pitch > 0.42) {
        anomalies.push({ code: 'looking_down', label: 'Looking down' })
      }
    }
  }

  const body = poses[0]
  if (body) {
    const nose = body[0]
    const leftShoulder = body[11]
    const rightShoulder = body[12]
    const leftWrist = body[15]
    const rightWrist = body[16]
    if (!visible(leftShoulder) || !visible(rightShoulder)) {
      anomalies.push({ code: 'shoulders_out', label: 'Shoulders are out of frame' })
    } else if (nose) {
      const rise = ((leftShoulder.y + rightShoulder.y) / 2) - nose.y
      if (rise < 0.07) {
        anomalies.push({ code: 'slouching', label: 'Posture looks slumped' })
      }
    }
    if (nose && ((visible(leftWrist) && distance(leftWrist, nose) < 0.12) || (visible(rightWrist) && distance(rightWrist, nose) < 0.12))) {
      anomalies.push({ code: 'hand_on_face', label: 'Hand is covering the face' })
    }
  }

  const primary = anomalies[0] || null
  return {
    ok: anomalies.length === 0 && faces.length === 1,
    anomalies,
    headline: primary ? primary.label : 'Body language looks steady',
  }
}

export function summarizeBodyLanguage(events) {
  const counts = new Map()
  events.forEach((event) => {
    counts.set(event.label, (counts.get(event.label) || 0) + 1)
  })
  const items = [...counts.entries()].map(([label, count]) => ({ label, count }))
  return {
    total: events.length,
    items,
    headline: items.length
      ? items.map((item) => `${item.label} × ${item.count}`).join(' · ')
      : 'No body-language anomalies detected.',
  }
}

async function createTask(Task, fileset, model, options) {
  const base = { modelAssetPath: model }
  try {
    return await Task.createFromOptions(fileset, {
      runningMode: 'VIDEO',
      ...options,
      baseOptions: { ...base, delegate: 'GPU' },
    })
  } catch {
    return Task.createFromOptions(fileset, {
      runningMode: 'VIDEO',
      ...options,
      baseOptions: { ...base, delegate: 'CPU' },
    })
  }
}

export async function startBodyLanguage(video, onReading) {
  const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  const face = await createTask(FaceLandmarker, fileset, FACE_MODEL, { numFaces: 2 })
  const pose = await createTask(PoseLandmarker, fileset, POSE_MODEL, { numPoses: 1 })
  let stopped = false
  let stamp = 0
  let timer = 0

  const tick = () => {
    if (stopped) return
    timer = window.setTimeout(tick, 800)
    if (video.readyState < 2 || !video.videoWidth) return
    stamp += 100
    try {
      const faceResult = face.detectForVideo(video, stamp)
      const poseResult = pose.detectForVideo(video, stamp)
      onReading(interpretBodyLanguage(faceResult, poseResult))
    } catch (error) {
      console.error('Body language frame failed:', error)
    }
  }

  tick()
  return () => {
    stopped = true
    window.clearTimeout(timer)
    face.close?.()
    pose.close?.()
  }
}
