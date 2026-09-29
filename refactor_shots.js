const fs = require('fs');
let code = fs.readFileSync('apps/api/app/api/v1/shots.py', 'utf8');

const importReplacement = rom app.schemas.shot import ShotResponse, ShotCreate, ShotPatch, ShotSequenceUpdate
from app.services.shot_service import ShotService
from app.core.exceptions import DomainError, NotFoundError, ConflictError;

code = code.replace(/from app\.schemas\.shot import.*/, importReplacement);

const newCreate = @router.post("/productions/{production_id}/shots", response_model=ShotResponse, status_code=status.HTTP_201_CREATED)
async def create_shot(
    production_id: str,
    req: ShotCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    try:
        shot = await ShotService.create_shot(db, production_id, req, user_id)
        return shot
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": e.code, "message": e.message})
    except DomainError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message});

code = code.replace(/@router\.post\("\/productions\/\{production_id\}\/shots"[\s\S]*?(?=@router\.patch)/, newCreate + '\n\n');

const newPatch = @router.patch("/shots/{id}", response_model=ShotResponse)
async def update_shot(
    id: str,
    req: ShotPatch,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    try:
        shot = await ShotService.patch_shot(db, id, req, user_id)
        return shot
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": e.code, "message": e.message})
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": "SHOT_REVISION_CONFLICT", "message": e.message, "details": e.details})
    except DomainError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message});

code = code.replace(/@router\.patch\("\/shots\/\{id\}"[\s\S]*?(?=@router\.delete)/, newPatch + '\n\n');

fs.writeFileSync('apps/api/app/api/v1/shots.py', code);
