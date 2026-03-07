from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import assessment, analysis, tts, progress

app = FastAPI(title="Speech Therapy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assessment.router)
app.include_router(analysis.router)
app.include_router(tts.router)
app.include_router(progress.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    print("Speech Therapy API running")
