import type { MediaViewProps } from '@/types/Media';
import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Share2,
  Check,
  X,
  SunMoon,
  Contrast,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Heart,
  Play,
  Pause,
  Lock,
} from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { useNavigate } from 'react-router-dom';
import NetflixStylePlayer from '../VideoPlayer/NetflixStylePlayer';

const MediaView: React.FC<MediaViewProps> = ({
  initialIndex,
  onClose,
  allMedia,
  currentPage,
  itemsPerPage,
  type,
  isSecureFolder,
}) => {
  // State management
  const [globalIndex, setGlobalIndex] = useState<number>(
    (currentPage - 1) * itemsPerPage + initialIndex,
  );
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [filter, setFilter] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('pictopy-favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const navigate = useNavigate();

  useEffect(() => {
    setGlobalIndex((currentPage - 1) * itemsPerPage + initialIndex);
  }, [initialIndex, currentPage, itemsPerPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNextItem();
      if (e.key === 'ArrowLeft') handlePrevItem();
      if (e.key === '+') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === 'r') handleRotate();
      if (e.key === 'f') toggleFavorite();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalIndex, onClose, favorites]);

  useEffect(() => {
    let slideshowInterval: NodeJS.Timeout | null = null;

    if (isSlideshowActive) {
      slideshowInterval = setInterval(() => {
        setGlobalIndex((prevIndex) => (prevIndex + 1) % allMedia.length);
      }, 3000);
    }

    return () => {
      if (slideshowInterval) clearInterval(slideshowInterval);
    };
  }, [isSlideshowActive, allMedia.length]);

  const handleZoomIn = () => setScale((s) => Math.min(4, s + 0.1));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, s - 0.1));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFavorite = () => {
    const currentMedia = allMedia[globalIndex].path || '';
    setFavorites((prev) => {
      const newFavorites = prev.includes(currentMedia)
        ? prev.filter((f) => f !== currentMedia)
        : [...prev, currentMedia];

      localStorage.setItem('pictopy-favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const handlePrevItem = () => {
    setGlobalIndex(globalIndex > 0 ? globalIndex - 1 : allMedia.length - 1);
    resetZoom();
    resetEditing();
  };

  const handleNextItem = () => {
    setGlobalIndex(globalIndex < allMedia.length - 1 ? globalIndex + 1 : 0);
    resetZoom();
    resetEditing();
  };

  const resetEditing = () => {
    setIsEditing(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setFilter('');
    setBrightness(100);
    setContrast(100);
    setPosition({ x: 0, y: 0 });
    setScale(1);
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
    console.log(`Notification: ${type} - ${message}`);
  };

  const handleShare = async () => {
    try {
      const filePath = allMedia[globalIndex].path;
      await invoke('share_file', { path: filePath });
      showNotification('File shared successfully', 'success');
    } catch (err: any) {
      showNotification(`Failed to share: ${err}`, 'error');
    }
  };

  const handleEditComplete = useCallback(async () => {
    console.log('Starting handleEditComplete');

    try {
      const imageData = await readFile(allMedia[globalIndex].path || '');
      console.log('Image file read successfully');

      const blob = new Blob([imageData], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Unable to create image context');
      }

      if (completedCrop) {
        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;
        ctx.drawImage(
          img,
          completedCrop.x,
          completedCrop.y,
          completedCrop.width,
          completedCrop.height,
          0,
          0,
          completedCrop.width,
          completedCrop.height,
        );
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      ctx.filter = `${filter} brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(canvas, 0, 0);

      console.log('Canvas prepared, attempting to create blob');

      const editedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!editedBlob) {
        throw new Error('Failed to create edited image blob');
      }

      console.log('Edited blob created successfully');

      const arrayBuffer = await editedBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      if (isSecureFolder) {
        // Save the edited image to a temporary location
        const tempPath = await invoke<string>('save_temp_image', {
          imageData: Array.from(uint8Array),
          originalPath: allMedia[globalIndex].path,
        });

        // Move the temporary file to the secure folder
        await invoke('move_to_secure_folder', {
          path: tempPath,
          password: prompt('Enter your secure folder password:'),
        });
      } else {
        console.log('Invoking save_edited_image');
        await invoke('save_edited_image', {
          imageData: Array.from(uint8Array),
          originalPath: allMedia[globalIndex].path,
          filter,
          brightness,
          contrast,
        });
      }

      console.log('Image saved successfully');
      showNotification('Image saved successfully', 'success');

      URL.revokeObjectURL(imageUrl);
    } catch (error) {
      console.error('Error in handleEditComplete:', error);
      showNotification(`Failed to save edited image: ${error}`, 'error');
    }

    setIsEditing(false);
  }, [
    completedCrop,
    filter,
    brightness,
    contrast,
    allMedia,
    globalIndex,
    showNotification,
    isSecureFolder,
  ]);

  const handleThumbnailClick = (index: number) => {
    setGlobalIndex(index);
    resetZoom();
  };

  const toggleSlideshow = () => {
    setIsSlideshowActive((prev) => !prev);
  };

  const isFavorite = (mediaUrl: string) => favorites.includes(mediaUrl);

  const handleMoveToSecureFolder = async () => {
    const currentMedia = allMedia[globalIndex];
    if (!currentMedia || !currentMedia.path) return;

    const secureFolderCreated = await invoke<boolean>(
      'check_secure_folder_status',
    );
    if (!secureFolderCreated) {
      navigate('/secure-folder');
      return;
    }

    try {
      const password = prompt('Enter your secure folder password:');
      if (!password) return;

      await invoke('move_to_secure_folder', {
        path: currentMedia.path,
        password,
      });
      showNotification('File moved to secure folder', 'success');
      // Remove the moved item from allMedia
      const newAllMedia = [...allMedia];
      newAllMedia.splice(globalIndex, 1);
      // Update allMedia state (you might need to lift this state up to a parent component)
      // setAllMedia(newAllMedia);
      if (newAllMedia.length === 0) {
        onClose();
      } else {
        setGlobalIndex(Math.min(globalIndex, newAllMedia.length - 1));
      }
    } catch (error) {
      showNotification(`Failed to move file: ${error}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm transition-all duration-300">
      <div className="absolute right-4 top-4 z-50 flex items-center gap-2.5 rounded-full bg-black/30 p-1.5 backdrop-blur-md">
        {!isSecureFolder && (
          <button
            onClick={handleShare}
            className="rounded-full bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30 hover:shadow-lg hover:shadow-white/10"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        )}
        {!isSecureFolder && (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-full bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30 hover:shadow-lg hover:shadow-white/10"
            aria-label="Edit"
          >
            <Edit className="h-5 w-5" />
          </button>
        )}
        {!isSecureFolder && (
          <button
            onClick={handleMoveToSecureFolder}
            className="rounded-full bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30 hover:shadow-lg hover:shadow-white/10"
            aria-label="Move to Secure Folder"
          >
            <Lock className="h-5 w-5" />
          </button>
        )}
        {!isSecureFolder && (
          <button
            onClick={toggleFavorite}
            className={`rounded-full p-2 text-white transition-all duration-300 ${
              isFavorite(allMedia[globalIndex].path || '')
                ? 'bg-red-500/80 hover:bg-red-600/80'
                : 'bg-white/15 hover:bg-white/30'
            } hover:shadow-lg hover:shadow-white/10`}
            aria-label={
              isFavorite(allMedia[globalIndex].path || '')
                ? 'Remove from favorites'
                : 'Add to favorites'
            }
          >
            <Heart
              className={`h-5 w-5 ${isFavorite(allMedia[globalIndex].path || '') ? 'fill-current' : ''}`}
            />
          </button>
        )}
        {type === 'image' ? (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-full bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30 hover:shadow-lg hover:shadow-white/10"
            aria-label="Edit"
          >
            <Edit className="h-5 w-5" />
          </button>
        ) : null}

        {type === 'image' ? (
          <button
            onClick={toggleSlideshow}
            className="rounded-full flex items-center gap-2 bg-white/15 px-4 py-2 text-white transition-all duration-200 hover:bg-white/30 hover:shadow-lg hover:shadow-white/10"
            aria-label="Toggle Slideshow"
          >
            {isSlideshowActive ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isSlideshowActive ? 'Pause' : 'Slideshow'}
            </span>
          </button>
        ) : null}

        <button
          onClick={onClose}
          className="rounded-full bg-white/15 p-2 text-white transition-all duration-200 hover:bg-red-500/80 hover:shadow-lg hover:shadow-red-500/20"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex h-full w-full items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {type === 'image' ? (
          <div
            id="zoomable-image"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative flex h-full w-full items-center justify-center overflow-hidden"
          >
            {isEditing ? (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-[90vh] max-w-[90vw]"
              >
                <img
                  id="source-image"
                  src={allMedia[globalIndex].url || '/placeholder.svg'}
                  alt={`image-${globalIndex}`}
                  style={{
                    filter: `${filter} brightness(${brightness}%) contrast(${contrast}%)`,
                  }}
                />
              </ReactCrop>
            ) : (
              <img
                src={allMedia[globalIndex].url || '/placeholder.svg'}
                alt={`image-${globalIndex}`}
                draggable={false}
                className="h-full w-full max-h-[90vh] max-w-[90vw] select-none object-contain"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transition: isDragging
                    ? 'none'
                    : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              />
            )}
          </div>
        ) : (
          <NetflixStylePlayer
            videoSrc={allMedia[globalIndex].url}
            description=""
            title=""
          />
        )}

        <button
          onClick={handlePrevItem}
          className="absolute left-4 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 transform items-center justify-center rounded-full bg-black/40 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-black/60"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={handleNextItem}
          className="absolute right-4 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 transform items-center justify-center rounded-full bg-black/40 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-black/60"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      
      {type === 'image' ? (
        <div className="absolute bottom-20 right-4 flex gap-2 rounded-2xl bg-black/40 p-2 backdrop-blur-md">
          <button
            onClick={handleZoomOut}
            className="rounded-xl bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30"
            aria-label="Zoom Out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={resetZoom}
            className="rounded-xl bg-white/15 px-4 py-2 text-white transition-all duration-200 hover:bg-white/30"
          >
            <span className="text-sm font-medium">Reset</span>
          </button>
          <button
            onClick={handleZoomIn}
            className="rounded-xl bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30"
            aria-label="Zoom In"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={handleRotate}
            className="rounded-xl bg-white/15 p-2 text-white transition-all duration-200 hover:bg-white/30"
            aria-label="Rotate"
          >
            <RotateCw className="h-5 w-5" />
          </button>
          {isEditing && (
            <>
              <button
                onClick={handleEditComplete}
                className="rounded-xl bg-green-500/80 p-2 text-white transition-all duration-200 hover:bg-green-600/80"
                aria-label="Confirm Edit"
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={resetEditing}
                className="rounded-xl bg-red-500/80 p-2 text-white transition-all duration-200 hover:bg-red-600/80"
                aria-label="Cancel Edit"
              >
                <X className="h-5 w-5" />
              </button>
              <select
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="">No Filter</option>
                <option value="grayscale(100%)">Grayscale</option>
                <option value="sepia(100%)">Sepia</option>
                <option value="invert(100%)">Invert</option>
              </select>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3">
                <SunMoon className="h-4 w-4 text-white" />
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-24 accent-white"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3">
                <Contrast className="h-4 w-4 text-white" />
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-24 accent-white"
                />
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Thumbnails */}
      {type === 'image' ? (
        <div>
          <div className="absolute bottom-0 flex w-full items-center justify-center gap-2 overflow-x-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-4 opacity-0 transition-opacity duration-300 hover:opacity-100">
            <div className="flex items-center justify-center gap-2 overflow-x-auto rounded-2xl bg-black/50 p-2 backdrop-blur-md">
              {allMedia.map((media, index) => (
                <div
                  key={index}
                  onClick={() => handleThumbnailClick(index)}
                  className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                    index === globalIndex
                      ? 'border-blue-500 shadow-lg shadow-blue-500/30'
                      : 'border-transparent'
                  } cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg`}
                >
                  {isFavorite(media.path || '') && (
                    <div className="absolute right-1 top-1 z-10">
                      <Heart className="h-4 w-4 fill-current text-red-500 drop-shadow-md" />
                    </div>
                  )}
                  {type === 'image' ? (
                    <img
                      src={media.thumbnailUrl || '/placeholder.svg'}
                      alt={`thumbnail-${index}`}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {notification && (
        <div
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-xl p-4 shadow-lg ${
            notification.type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'
          } backdrop-blur-sm text-lg font-bold text-white transition-all duration-300 animate-fadeIn`}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default MediaView;
