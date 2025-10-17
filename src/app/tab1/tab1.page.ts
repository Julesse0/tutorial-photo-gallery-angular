import { Component, OnInit } from '@angular/core';
import { PhotoService } from '../services/photo.service';
import { AlertController, Platform } from '@ionic/angular';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page implements OnInit {

  constructor(
    public photoService: PhotoService,
    private alertController: AlertController,
    private platform: Platform
  ) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
    
    // Vérifier et demander les permissions au chargement
    if (this.platform.is('capacitor')) {
      await this.checkAndRequestPermissions();
    }
  }

  private async checkAndRequestPermissions() {
    try {
      // Vérifier les permissions caméra
      const cameraPermission = await Camera.checkPermissions();
      
      // Vérifier les permissions localisation
      const locationPermission = await Geolocation.checkPermissions();

      const needsCameraPermission = cameraPermission.camera !== 'granted';
      const needsLocationPermission = locationPermission.location !== 'granted';

      if (needsCameraPermission || needsLocationPermission) {
        await this.showPermissionAlert(needsCameraPermission, needsLocationPermission);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
    }
  }

  private async showPermissionAlert(needsCamera: boolean, needsLocation: boolean) {
    let message = 'Cette application nécessite les permissions suivantes pour fonctionner correctement :\n\n';
    
    if (needsCamera) {
      message += '• Caméra : pour prendre des photos\n';
    }
    if (needsLocation) {
      message += '• Localisation : pour géolocaliser vos photos\n';
    }
    
    message += '\nCes permissions sont indispensables au bon fonctionnement de l\'application.';

    const alert = await this.alertController.create({
      header: 'Permissions requises',
      message: message,
      backdropDismiss: false,
      buttons: [
        {
          text: 'Refuser',
          role: 'cancel',
          handler: () => {
            this.showPermissionDeniedAlert();
          }
        },
        {
          text: 'Autoriser',
          handler: async () => {
            await this.requestPermissions(needsCamera, needsLocation);
          }
        }
      ]
    });

    await alert.present();
  }

  private async requestPermissions(needsCamera: boolean, needsLocation: boolean) {
    try {
      if (needsCamera) {
        await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      }
      
      if (needsLocation) {
        await Geolocation.requestPermissions({ permissions: ['location'] });
      }
    } catch (error) {
      console.error('Erreur lors de la demande de permissions:', error);
      await this.showPermissionDeniedAlert();
    }
  }

  private async showPermissionDeniedAlert() {
    const alert = await this.alertController.create({
      header: 'Attention',
      message: 'Sans ces permissions, l\'application ne pourra pas fonctionner correctement. Vous pouvez les activer plus tard dans les paramètres de l\'application.',
      buttons: ['OK']
    });

    await alert.present();
  }
}