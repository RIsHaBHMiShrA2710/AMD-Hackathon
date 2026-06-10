from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.item import Item, ItemCreate, ItemUpdate
from app.crud import item as crud_item

router = APIRouter()


@router.post("/", response_model=Item, status_code=status.HTTP_201_CREATED)
def create_item(item_in: ItemCreate, db: Session = Depends(get_db)):
    return crud_item.create_item(db=db, item_in=item_in)


@router.get("/", response_model=List[Item])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_item.get_items(db=db, skip=skip, limit=limit)


@router.get("/{item_id}", response_model=Item)
def read_item(item_id: int, db: Session = Depends(get_db)):
    db_item = crud_item.get_item(db=db, item_id=item_id)
    if db_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return db_item


@router.put("/{item_id}", response_model=Item)
def update_item(item_id: int, item_in: ItemUpdate, db: Session = Depends(get_db)):
    db_item = crud_item.get_item(db=db, item_id=item_id)
    if db_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return crud_item.update_item(db=db, db_item=db_item, item_in=item_in)


@router.delete("/{item_id}", response_model=Item)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    db_item = crud_item.get_item(db=db, item_id=item_id)
    if db_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return crud_item.delete_item(db=db, item_id=item_id)
