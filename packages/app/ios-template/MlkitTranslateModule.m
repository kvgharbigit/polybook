#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MlkitTranslate, NSObject)

RCT_EXTERN_METHOD(ensureModel:(NSString*)lang 
                  withResolver:(RCTPromiseResolveBlock)resolve 
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deleteModel:(NSString*)lang 
                  withResolver:(RCTPromiseResolveBlock)resolve 
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(translate:(NSString*)text 
                  from:(NSString*)from 
                  to:(NSString*)to 
                  withResolver:(RCTPromiseResolveBlock)resolve 
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getInstalledModels:(RCTPromiseResolveBlock)resolve 
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end