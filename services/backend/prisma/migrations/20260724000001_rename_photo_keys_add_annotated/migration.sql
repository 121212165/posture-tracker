-- AlterTable: 重命名字段 photoFrontUrl -> photoFrontKey, photoSideUrl -> photoSideKey
ALTER TABLE "Assessment" RENAME COLUMN "photoFrontUrl" TO "photoFrontKey";
ALTER TABLE "Assessment" RENAME COLUMN "photoSideUrl" TO "photoSideKey";

-- AlterTable: 新增标注图字段
ALTER TABLE "Assessment" ADD COLUMN "annotatedImageKey" TEXT;
