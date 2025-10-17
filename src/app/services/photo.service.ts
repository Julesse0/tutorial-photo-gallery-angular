import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';
import { Subject } from 'rxjs';
import { NgZone } from '@angular/core';

export interface UserPhoto {
  id: string;
  filepath: string;
  webviewPath: string;
  createdAt: string;
  liked: boolean;
  likes: number;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE = 'photos';
  public changed$ = new Subject<UserPhoto[]>();

  constructor(private platform: Platform, private zone: NgZone) {}

  public async loadSaved(): Promise<void> {
    const photoList = await Preferences.get({ key: this.PHOTO_STORAGE });
    const arr: any[] = JSON.parse(photoList.value || '[]');
    this.photos = arr.map(p => ({
        id: p.id || this.genId(),
        filepath: p.filepath,
        webviewPath: p.webviewPath,
        createdAt: p.createdAt || new Date().toISOString(),
        liked: !!p.liked,
        likes: typeof p.likes === 'number' ? p.likes : 0,
        latitude: typeof p.latitude === 'number' ? p.latitude : null,
        longitude: typeof p.longitude === 'number' ? p.longitude : null,
        place: typeof p.place === 'string' ? p.place : null
    }));

    if (!this.platform.is('hybrid')) {
        await Promise.all(this.photos.map(async (p) => {
            const readFile = await Filesystem.readFile({
                path: p.filepath,
                directory: Directory.Data
            });
            p.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
        }));
    }
}
  public async addNewToGallery() {
    const capturedPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 100
    });

    const pos = await this.getWebPosition();
    const savedImageFile = await this.savePicture(capturedPhoto);
    
    let place: string | null = null;
    if (pos) {
        place = await this.reverseGeocode(pos.lat, pos.lon);
    }

    const item: UserPhoto = {
        id: this.genId(),
        filepath: savedImageFile.filepath,
        webviewPath: savedImageFile.webviewPath!,
        createdAt: new Date().toISOString(),
        liked: false,
        likes: 0,
        latitude: pos?.lat ?? null,
        longitude: pos?.lon ?? null,
        place
    };

    // Load the photo's data asynchronously
    if (!this.platform.is('hybrid')) {
        const readFile = await Filesystem.readFile({
            path: savedImageFile.filepath,
            directory: Directory.Data
        });
        item.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
    }

    // Update photos array and notify subscribers immediately
    this.photos.unshift(item);
    this.changed$.next([...this.photos]); // Notify subscribers about the new photo

    await Preferences.set({
        key: this.PHOTO_STORAGE,
        value: JSON.stringify(this.photos)
    });
}
  public async toggleLike(photoId: string) {
    const i = this.photos.findIndex(p => p.id === photoId);
    if (i > -1) {
      this.photos[i].liked = !this.photos[i].liked;
      this.photos[i].likes += this.photos[i].liked ? 1 : -1;
      await Preferences.set({
        key: this.PHOTO_STORAGE,
        value: JSON.stringify(this.photos)
      });
      this.changed$.next([...this.photos]);
    }
  }

  public async deletePicture(photo: UserPhoto, position: number) {
    this.photos.splice(position, 1);
    await Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });

    const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data
    });

    this.changed$.next([...this.photos]);
  }

  private async savePicture(photo: Photo) {
    const base64Data = await this.readAsBase64(photo);
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: photo.webPath
      };
    }
  }

  private async readAsBase64(photo: Photo) {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path!
      });
      return file.data;
    } else {
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      return await this.convertBlobToBase64(blob) as string;
    }
  }

  private async getWebPosition(): Promise<{ lat: number; lon: number } | null> {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      return {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };
    } catch {
      return null;
    }
  }

  private async reverseGeocode(lat: number, lon: number): Promise<string | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
      );
      const data = await response.json();
      
      // Simplifier l'adresse
      const address = data.address;
      if (address) {
        const parts = [];
        if (address.city) parts.push(address.city);
        else if (address.town) parts.push(address.town);
        else if (address.village) parts.push(address.village);
        
        if (address.country) parts.push(address.country);
        
        return parts.join(', ') || data.display_name;
      }
      
      return data.display_name || null;
    } catch {
      return null;
    }
  }

  private genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  convertBlobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
}