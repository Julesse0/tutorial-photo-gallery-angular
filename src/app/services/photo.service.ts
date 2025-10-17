import { Injectable, NgZone } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE = 'photos';
  public changed$ = new Subject<UserPhoto[]>();

  constructor(private platform: Platform, private zone: NgZone) {}

  public async loadSaved() {
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
      for (let photo of this.photos) {
        const readFile = await Filesystem.readFile({ path: photo.filepath, directory: Directory.Data });
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
    for (const p of this.photos) {
      if (p.latitude != null && p.longitude != null && !p.place) {
        const name = await this.reverseGeocode(p.latitude, p.longitude);
        if (name) {
          p.place = name;
          await Preferences.set({ key: this.PHOTO_STORAGE, value: JSON.stringify(this.photos) });
        }
      }
    }
    this.changed$.next(this.photos);
  }

  public async addNewToGallery() {
    const capturedPhoto = await Camera.getPhoto({ resultType: CameraResultType.Uri, source: CameraSource.Camera, quality: 100 });
    const pos = await this.getWebPosition();
    const savedImageFile = await this.savePicture(capturedPhoto);
    let place: string | null = null;
    if (pos) place = await this.reverseGeocode(pos.lat, pos.lon);
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
    this.zone.run(() => { this.photos = [item, ...this.photos]; });
    await Preferences.set({ key: this.PHOTO_STORAGE, value: JSON.stringify(this.photos) });
    this.changed$.next(this.photos);
  }

  public async toggleLike(photoId: string) {
    const i = this.photos.findIndex(p => p.id === photoId);
    if (i > -1) {
      const p = this.photos[i];
      p.liked = !p.liked;
      p.likes = Math.max(0, p.likes + (p.liked ? 1 : -1));
      await Preferences.set({ key: this.PHOTO_STORAGE, value: JSON.stringify(this.photos) });
      this.changed$.next(this.photos);
    }
  }

  public async deletePicture(photo: UserPhoto, position: number) {
    this.photos.splice(position, 1);
    await Preferences.set({ key: this.PHOTO_STORAGE, value: JSON.stringify(this.photos) });
    const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({ path: filename, directory: Directory.Data });
    this.changed$.next(this.photos);
  }

  private async savePicture(photo: Photo) {
    const base64Data = await this.readAsBase64(photo);
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Data });
    if (this.platform.is('hybrid')) {
      return { filepath: savedFile.uri, webviewPath: Capacitor.convertFileSrc(savedFile.uri) };
    } else {
      return { filepath: fileName, webviewPath: `data:image/jpeg;base64,${base64Data}` };
    }
  }

  private async readAsBase64(photo: Photo) {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({ path: photo.path! });
      return file.data;
    } else {
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      return (await this.convertBlobToBase64(blob)) as string;
    }
  }

  private async getWebPosition(): Promise<{ lat: number; lon: number } | null> {
    if (this.platform.is('hybrid')) return null;
    if (!('geolocation' in navigator)) return null;
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    });
  }

  private async reverseGeocode(lat: number, lon: number): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } as any, mode: 'cors' as any });
      if (!res.ok) return null;
      const j = await res.json();
      const a = j.address || {};
      const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county;
      const cc = a.country_code ? String(a.country_code).toUpperCase() : '';
      return city ? (cc ? `${city}, ${cc}` : city) : (j.display_name ? String(j.display_name).split(',')[0] : null);
    } catch {
      return null;
    }
  }

  private genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  convertBlobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
}

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
