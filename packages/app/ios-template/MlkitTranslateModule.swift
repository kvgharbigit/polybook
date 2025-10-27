import Foundation
import MLKitTranslate
import MLKitCommon

@objc(MlkitTranslate)
class MlkitTranslate: NSObject {
    
    @objc(ensureModel:withResolver:withRejecter:)
    func ensureModel(lang: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let language = TranslateLanguage(rawValue: lang) else {
            reject("INVALID_LANG", "Invalid language code: \(lang)", nil)
            return
        }
        
        let model = TranslateRemoteModel.translateRemoteModel(language: language)
        let conditions = ModelDownloadConditions(
            allowsCellularAccess: false,
            allowsBackgroundDownloading: true
        )
        
        ModelManager.modelManager().download(model, conditions: conditions) { error in
            if let error = error {
                reject("DL_FAIL", "Failed to download model for \(lang): \(error.localizedDescription)", error)
                return
            }
            resolve(nil)
        }
    }
    
    @objc(deleteModel:withResolver:withRejecter:)
    func deleteModel(lang: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let language = TranslateLanguage(rawValue: lang) else {
            reject("INVALID_LANG", "Invalid language code: \(lang)", nil)
            return
        }
        
        let model = TranslateRemoteModel.translateRemoteModel(language: language)
        ModelManager.modelManager().deleteDownloadedModel(model) { error in
            if let error = error {
                reject("DEL_FAIL", "Failed to delete model for \(lang): \(error.localizedDescription)", error)
                return
            }
            resolve(nil)
        }
    }
    
    @objc(translate:from:to:withResolver:withRejecter:)
    func translate(text: String, from: String, to: String,
                   resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let sourceLanguage = TranslateLanguage(rawValue: from),
              let targetLanguage = TranslateLanguage(rawValue: to) else {
            reject("INVALID_LANG", "Invalid language codes: \(from) -> \(to)", nil)
            return
        }
        
        let options = TranslatorOptions(sourceLanguage: sourceLanguage, targetLanguage: targetLanguage)
        let translator = Translator.translator(options: options)
        
        translator.downloadModelIfNeeded { error in
            if let error = error {
                reject("DL_NEED_FAIL", "Model download required but failed for \(from)->\(to): \(error.localizedDescription)", error)
                return
            }
            
            translator.translate(text) { translatedText, error in
                if let error = error {
                    reject("XLT_FAIL", "Translation failed from \(from) to \(to): \(error.localizedDescription)", error)
                    return
                }
                
                guard let translatedText = translatedText else {
                    reject("XLT_FAIL", "Translation returned nil result", nil)
                    return
                }
                
                resolve(translatedText)
            }
        }
    }
    
    @objc(getInstalledModels:withRejecter:)
    func getInstalledModels(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        ModelManager.modelManager().downloadedTranslateModels { models, error in
            if let error = error {
                reject("LIST_FAIL", "Failed to get installed models: \(error.localizedDescription)", error)
                return
            }
            
            let languageCodes = models?.compactMap { $0.language.rawValue } ?? []
            resolve(languageCodes)
        }
    }
}

// Required for React Native bridge
extension MlkitTranslate {
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}