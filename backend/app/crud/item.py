from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate


def get_item(db: Session, item_id: int) -> Optional[Item]:
    return db.query(Item).filter(Item.id == item_id).first()


def get_items(db: Session, skip: int = 0, limit: int = 100) -> List[Item]:
    return db.query(Item).order_by(Item.id.desc()).offset(skip).limit(limit).all()


def create_item(db: Session, item_in: ItemCreate) -> Item:
    db_item = Item(
        title=item_in.title,
        description=item_in.description,
        status=item_in.status,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_item(db: Session, db_item: Item, item_in: ItemUpdate) -> Item:
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int) -> Optional[Item]:
    db_item = db.query(Item).filter(Item.id == item_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return db_item
