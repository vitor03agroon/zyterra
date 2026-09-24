from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)

    nome = Column(
        String(150),
        nullable=False,
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    senha_hash = Column(
        String(255),
        nullable=False,
    )

    telefone = Column(
        String(30),
        nullable=True,
    )

    criado_em = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
