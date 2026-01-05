"""
Base service pattern for business logic
"""
from typing import Generic, TypeVar, Optional, List, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import Base
from app.shared.base_repo import BaseRepository
from app.core.logging import get_logger

# Type variables
ModelType = TypeVar("ModelType", bound=Base)
RepositoryType = TypeVar("RepositoryType", bound=BaseRepository)

logger = get_logger(__name__)


class BaseService(Generic[ModelType, RepositoryType]):
    """
    Base service providing common business logic operations
    
    This class implements the service pattern, separating business logic
    from repository/data access concerns.
    
    Type Parameters:
        ModelType: SQLAlchemy model class
        RepositoryType: Repository class for data access
    """
    
    def __init__(self, repository: RepositoryType):
        """
        Initialize service with repository
        
        Args:
            repository: Repository instance for data access
        """
        self.repository = repository
    
    async def get_by_id(self, id: Any) -> Optional[ModelType]:
        """
        Retrieve an entity by ID
        
        Args:
            id: Entity identifier
        
        Returns:
            Entity instance or None
        """
        logger.debug(f"Service: Getting entity by id={id}")
        return await self.repository.get_by_id(id)
    
    async def get_by_id_or_fail(self, id: Any) -> ModelType:
        """
        Retrieve an entity by ID or raise error
        
        Args:
            id: Entity identifier
        
        Returns:
            Entity instance
        
        Raises:
            NotFoundError: If entity not found
        """
        logger.debug(f"Service: Getting entity by id={id} (fail if not found)")
        return await self.repository.get_by_id_or_fail(id)
    
    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """
        Retrieve all entities with pagination
        
        Args:
            skip: Number to skip
            limit: Maximum number to return
        
        Returns:
            List of entities
        """
        logger.debug(f"Service: Getting all entities skip={skip} limit={limit}")
        return await self.repository.get_all(skip=skip, limit=limit)
    
    async def create(self, **kwargs) -> ModelType:
        """
        Create a new entity
        
        Args:
            **kwargs: Entity field values
        
        Returns:
            Created entity
        """
        logger.info(f"Service: Creating new entity")
        return await self.repository.create(**kwargs)
    
    async def update(self, id: Any, **kwargs) -> ModelType:
        """
        Update an entity
        
        Args:
            id: Entity identifier
            **kwargs: Fields to update
        
        Returns:
            Updated entity
        """
        logger.info(f"Service: Updating entity id={id}")
        return await self.repository.update_by_id(id, **kwargs)
    
    async def delete(self, id: Any) -> bool:
        """
        Delete an entity
        
        Args:
            id: Entity identifier
        
        Returns:
            True if deleted
        """
        logger.info(f"Service: Deleting entity id={id}")
        return await self.repository.delete_by_id(id)
    
    async def exists(self, id: Any) -> bool:
        """
        Check if entity exists
        
        Args:
            id: Entity identifier
        
        Returns:
            True if exists
        """
        logger.debug(f"Service: Checking if entity exists id={id}")
        return await self.repository.exists(id)
    
    async def count(self) -> int:
        """
        Count total entities
        
        Returns:
            Total count
        """
        logger.debug("Service: Counting entities")
        return await self.repository.count()

