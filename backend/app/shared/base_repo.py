"""
Base repository pattern for database operations
"""
from typing import Generic, Type, TypeVar, Optional, List, Any

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import Base
from app.shared.exceptions import NotFoundError, DatabaseError

# Type variable for model class
ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Base repository providing common CRUD operations
    
    This class implements the repository pattern for database access,
    providing a clean abstraction over SQLAlchemy operations.
    
    Type Parameters:
        ModelType: SQLAlchemy model class
    """
    
    def __init__(self, model: Type[ModelType], session: AsyncSession):
        """
        Initialize repository with model and session
        
        Args:
            model: SQLAlchemy model class
            session: Async database session
        """
        self.model = model
        self.session = session
    
    async def get_by_id(self, id: Any) -> Optional[ModelType]:
        """
        Retrieve a record by its primary key
        
        Args:
            id: Primary key value
        
        Returns:
            Model instance or None if not found
        """
        try:
            return await self.session.get(self.model, id)
        except Exception as e:
            raise DatabaseError(
                f"Failed to retrieve {self.model.__name__}",
                details={"id": id, "error": str(e)}
            )
    
    async def get_by_id_or_fail(self, id: Any) -> ModelType:
        """
        Retrieve a record by its primary key or raise NotFoundError
        
        Args:
            id: Primary key value
        
        Returns:
            Model instance
        
        Raises:
            NotFoundError: If record not found
        """
        record = await self.get_by_id(id)
        if not record:
            raise NotFoundError(
                f"{self.model.__name__} not found",
                details={"id": id}
            )
        return record
    
    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """
        Retrieve all records with pagination
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
        
        Returns:
            List of model instances
        """
        try:
            stmt = select(self.model).offset(skip).limit(limit)
            result = await self.session.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            raise DatabaseError(
                f"Failed to retrieve {self.model.__name__} list",
                details={"error": str(e)}
            )
    
    async def create(self, **kwargs) -> ModelType:
        """
        Create a new record
        
        Args:
            **kwargs: Field values for the new record
        
        Returns:
            Created model instance
        """
        try:
            instance = self.model(**kwargs)
            self.session.add(instance)
            await self.session.flush()
            await self.session.refresh(instance)
            return instance
        except Exception as e:
            raise DatabaseError(
                f"Failed to create {self.model.__name__}",
                details={"error": str(e)}
            )
    
    async def update_by_id(self, id: Any, **kwargs) -> ModelType:
        """
        Update a record by its primary key
        
        Args:
            id: Primary key value
            **kwargs: Fields to update
        
        Returns:
            Updated model instance
        
        Raises:
            NotFoundError: If record not found
        """
        try:
            instance = await self.get_by_id_or_fail(id)
            
            for key, value in kwargs.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)
            
            await self.session.flush()
            await self.session.refresh(instance)
            return instance
        except NotFoundError:
            raise
        except Exception as e:
            raise DatabaseError(
                f"Failed to update {self.model.__name__}",
                details={"id": id, "error": str(e)}
            )
    
    async def delete_by_id(self, id: Any) -> bool:
        """
        Delete a record by its primary key
        
        Args:
            id: Primary key value
        
        Returns:
            True if deleted, False if not found
        """
        try:
            instance = await self.get_by_id(id)
            if not instance:
                return False
            
            await self.session.delete(instance)
            await self.session.flush()
            return True
        except Exception as e:
            raise DatabaseError(
                f"Failed to delete {self.model.__name__}",
                details={"id": id, "error": str(e)}
            )
    
    async def exists(self, id: Any) -> bool:
        """
        Check if a record exists by its primary key
        
        Args:
            id: Primary key value
        
        Returns:
            True if exists, False otherwise
        """
        instance = await self.get_by_id(id)
        return instance is not None
    
    async def count(self) -> int:
        """
        Count total number of records
        
        Returns:
            Total count
        """
        try:
            stmt = select(self.model)
            result = await self.session.execute(stmt)
            return len(result.scalars().all())
        except Exception as e:
            raise DatabaseError(
                f"Failed to count {self.model.__name__}",
                details={"error": str(e)}
            )

